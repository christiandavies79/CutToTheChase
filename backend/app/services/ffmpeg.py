"""FFmpeg wrapper for video probing, thumbnail/waveform generation, and trimming."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any, Callable

from ..models.schemas import CuttingMode, TimeRange, TrimProgress, VideoInfo

logger = logging.getLogger(__name__)

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"

# Check for NVIDIA GPU support
_nvidia_available: bool | None = None


async def _check_nvidia() -> bool:
    """Detect whether NVIDIA GPU encoding is available."""
    global _nvidia_available
    if _nvidia_available is not None:
        return _nvidia_available
    try:
        proc = await asyncio.create_subprocess_exec(
            FFMPEG, "-hide_banner", "-encoders",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        _nvidia_available = b"h264_nvenc" in stdout
    except Exception:
        _nvidia_available = False
    logger.info("NVIDIA GPU encoding available: %s", _nvidia_available)
    return _nvidia_available


async def probe_video(path: str) -> VideoInfo:
    """Use ffprobe to extract video metadata."""
    cmd = [
        FFPROBE, "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        path,
    ]
    logger.info("Probing: %s", " ".join(cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {stderr.decode(errors='replace')}")

    data = json.loads(stdout)
    fmt = data.get("format", {})
    streams = data.get("streams", [])

    # Find video stream
    video_stream: dict[str, Any] | None = None
    audio_streams: list[dict[str, Any]] = []
    subtitle_streams: list[dict[str, Any]] = []
    for s in streams:
        codec_type = s.get("codec_type")
        if codec_type == "video" and video_stream is None:
            video_stream = s
        elif codec_type == "audio":
            audio_streams.append(s)
        elif codec_type == "subtitle":
            subtitle_streams.append(s)

    if video_stream is None:
        raise ValueError("No video stream found in file.")

    duration = float(fmt.get("duration", video_stream.get("duration", 0)))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # Parse frame rate
    fps_str = video_stream.get("r_frame_rate", "30/1")
    if "/" in fps_str:
        num, den = fps_str.split("/")
        fps = float(num) / float(den) if float(den) != 0 else 30.0
    else:
        fps = float(fps_str)

    file_size = int(fmt.get("size", 0))
    bitrate = int(fmt.get("bit_rate", 0))
    container = Path(path).suffix.lstrip(".").lower()

    audio_codec = audio_streams[0].get("codec_name") if audio_streams else None

    return VideoInfo(
        path=path,
        filename=Path(path).name,
        duration=duration,
        width=width,
        height=height,
        codec=video_stream.get("codec_name", "unknown"),
        audio_codec=audio_codec,
        container=container,
        file_size=file_size,
        bitrate=bitrate,
        fps=fps,
        has_audio=len(audio_streams) > 0,
        audio_tracks=len(audio_streams),
        subtitle_tracks=len(subtitle_streams),
    )


async def generate_thumbnails(path: str, count: int = 100) -> list[str]:
    """Generate thumbnail images at regular intervals, returning base64 data URIs."""
    info = await probe_video(path)
    interval = info.duration / count if count > 0 else 1.0
    tmpdir = tempfile.mkdtemp(prefix="cttc_thumbs_")

    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "warning",
        "-i", path,
        "-vf", f"fps=1/{max(interval, 0.5)},scale=160:-1",
        "-q:v", "8",
        "-frames:v", str(count),
        os.path.join(tmpdir, "thumb_%04d.jpg"),
    ]
    logger.info("Generating thumbnails: %s", " ".join(cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.warning("Thumbnail generation issues: %s", stderr.decode(errors="replace"))

    import base64
    thumbnails: list[str] = []
    for f in sorted(os.listdir(tmpdir)):
        fpath = os.path.join(tmpdir, f)
        with open(fpath, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()
            thumbnails.append(f"data:image/jpeg;base64,{b64}")
        os.unlink(fpath)
    os.rmdir(tmpdir)
    return thumbnails


async def generate_waveform(path: str, samples: int = 1000) -> list[float]:
    """Extract audio waveform peak data from a video file."""
    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "warning",
        "-i", path,
        "-ac", "1",
        "-filter:a", f"aresample=8000,asetnsamples=n={samples}",
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "pipe:1",
    ]
    logger.info("Generating waveform: %s", " ".join(cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if not stdout:
        logger.warning("No audio data for waveform: %s", stderr.decode(errors="replace"))
        return [0.0] * samples

    import struct
    float_count = len(stdout) // 4
    values = list(struct.unpack(f"<{float_count}f", stdout[:float_count * 4]))

    # Normalize to -1..1 range and downsample to requested sample count
    if not values:
        return [0.0] * samples

    max_val = max(abs(v) for v in values) or 1.0
    normalized = [v / max_val for v in values]

    if len(normalized) <= samples:
        return normalized

    # Downsample by averaging chunks
    chunk_size = len(normalized) / samples
    result: list[float] = []
    for i in range(samples):
        start = int(i * chunk_size)
        end = int((i + 1) * chunk_size)
        chunk = normalized[start:end]
        if chunk:
            # Use peak value for better visual representation
            peak = max(chunk, key=abs)
            result.append(round(peak, 4))
        else:
            result.append(0.0)
    return result


def _compute_keep_segments(
    duration: float, removal_ranges: list[TimeRange]
) -> list[tuple[float, float]]:
    """Given removal ranges, compute the segments to keep."""
    # Sort and merge overlapping removal ranges
    if not removal_ranges:
        return [(0.0, duration)]

    sorted_ranges = sorted(removal_ranges, key=lambda r: r.start)
    merged: list[tuple[float, float]] = []
    for r in sorted_ranges:
        if merged and r.start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], r.end))
        else:
            merged.append((r.start, r.end))

    # Build keep segments from the gaps
    keep: list[tuple[float, float]] = []
    pos = 0.0
    for start, end in merged:
        if start > pos:
            keep.append((pos, start))
        pos = end
    if pos < duration:
        keep.append((pos, duration))

    return keep


# Active trim jobs for cancellation
_active_jobs: dict[str, asyncio.subprocess.Process] = {}


def cancel_job(job_id: str) -> bool:
    """Cancel an active trim job."""
    proc = _active_jobs.get(job_id)
    if proc and proc.returncode is None:
        proc.terminate()
        logger.info("Cancelled job %s", job_id)
        return True
    return False


async def trim_video(
    source_path: str,
    output_path: str,
    removal_ranges: list[TimeRange],
    cutting_mode: CuttingMode,
    duration: float,
    progress_callback: Callable[[TrimProgress], Any] | None = None,
) -> str:
    """
    Trim a video by removing specified ranges and concatenating the kept segments.

    Returns the output file path on success.
    """
    job_id = str(uuid.uuid4())
    keep_segments = _compute_keep_segments(duration, removal_ranges)

    if not keep_segments:
        raise ValueError("All content would be removed. At least one segment must be retained.")

    tmpdir = tempfile.mkdtemp(prefix="cttc_trim_")
    concat_file = os.path.join(tmpdir, "concat.txt")
    segment_files: list[str] = []

    use_gpu = await _check_nvidia() if cutting_mode == CuttingMode.FRAME_ACCURATE else False

    async def _report(status: str, progress: float, message: str = ""):
        if progress_callback:
            await progress_callback(TrimProgress(
                job_id=job_id, status=status, progress=progress, message=message
            ))

    try:
        await _report("processing", 0, "Preparing segments...")
        total_segments = len(keep_segments)

        for idx, (seg_start, seg_end) in enumerate(keep_segments):
            seg_file = os.path.join(tmpdir, f"seg_{idx:04d}{Path(source_path).suffix}")
            segment_files.append(seg_file)

            if cutting_mode == CuttingMode.LOSSLESS:
                # Stream copy — fast but keyframe-aligned
                cmd = [
                    FFMPEG, "-hide_banner", "-loglevel", "warning",
                    "-y",
                    "-ss", str(seg_start),
                    "-to", str(seg_end),
                    "-i", source_path,
                    "-c", "copy",
                    "-map", "0",
                    "-avoid_negative_ts", "make_zero",
                    seg_file,
                ]
            else:
                # Frame-accurate: re-encode only if needed
                video_enc = ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "18"] if use_gpu \
                    else ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]
                cmd = [
                    FFMPEG, "-hide_banner", "-loglevel", "warning",
                    "-y",
                    "-ss", str(seg_start),
                    "-to", str(seg_end),
                    "-i", source_path,
                    *video_enc,
                    "-c:a", "copy",
                    "-c:s", "copy",
                    "-map", "0",
                    "-avoid_negative_ts", "make_zero",
                    seg_file,
                ]

            logger.info("Segment %d/%d: %s", idx + 1, total_segments, " ".join(cmd))
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _active_jobs[job_id] = proc
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace")
                logger.error("Segment %d failed: %s", idx, err_msg)
                raise RuntimeError(f"FFmpeg segment extraction failed: {err_msg}")

            pct = ((idx + 1) / total_segments) * 80
            await _report("processing", pct, f"Segment {idx + 1}/{total_segments} complete")

        # Build concat file
        with open(concat_file, "w") as f:
            for sf in segment_files:
                f.write(f"file '{sf}'\n")

        await _report("processing", 85, "Concatenating segments...")

        # Concatenate
        concat_cmd = [
            FFMPEG, "-hide_banner", "-loglevel", "warning",
            "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            "-map", "0",
            "-movflags", "+faststart",
            output_path,
        ]
        logger.info("Concat: %s", " ".join(concat_cmd))
        proc = await asyncio.create_subprocess_exec(
            *concat_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _active_jobs[job_id] = proc
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace")
            logger.error("Concatenation failed: %s", err_msg)
            raise RuntimeError(f"FFmpeg concatenation failed: {err_msg}")

        # Try to copy metadata from the source
        await _copy_metadata(source_path, output_path, tmpdir)

        await _report("completed", 100, "Done", )
        return output_path

    except asyncio.CancelledError:
        cancel_job(job_id)
        await _report("cancelled", 0, "Job cancelled")
        raise
    except Exception as exc:
        await _report("error", 0, str(exc))
        raise
    finally:
        _active_jobs.pop(job_id, None)
        # Cleanup temp files
        for sf in segment_files:
            try:
                os.unlink(sf)
            except OSError:
                pass
        try:
            os.unlink(concat_file)
        except OSError:
            pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


async def _copy_metadata(source: str, target: str, tmpdir: str) -> None:
    """Attempt to copy global metadata (chapters, tags) from source to target."""
    tmp_out = os.path.join(tmpdir, "meta_" + Path(target).name)
    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "warning",
        "-y",
        "-i", target,
        "-i", source,
        "-map", "0",
        "-map_metadata", "1",
        "-map_chapters", "1",
        "-c", "copy",
        tmp_out,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()
    if proc.returncode == 0 and os.path.isfile(tmp_out):
        shutil.move(tmp_out, target)
    else:
        # If metadata copy fails, keep the original output
        try:
            os.unlink(tmp_out)
        except OSError:
            pass


async def get_keyframes(path: str) -> list[float]:
    """Extract keyframe timestamps from a video."""
    cmd = [
        FFPROBE, "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "packet=pts_time,flags",
        "-of", "csv=print_section=0",
        path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    keyframes: list[float] = []
    for line in stdout.decode(errors="replace").splitlines():
        parts = line.strip().split(",")
        if len(parts) >= 2 and "K" in parts[1]:
            try:
                keyframes.append(float(parts[0]))
            except (ValueError, IndexError):
                continue
    return keyframes
