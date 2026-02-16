"""Video metadata, streaming, thumbnail, and waveform routes."""

from __future__ import annotations

import logging
import mimetypes
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..models.schemas import VideoInfo
from ..services.ffmpeg import generate_thumbnails, generate_waveform, get_keyframes, probe_video
from ..services.file_manager import validate_video_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/video", tags=["video"])


@router.get("/info", response_model=VideoInfo)
async def video_info(path: str = Query(..., description="Video file path")):
    """Get metadata for a video file."""
    error = validate_video_file(path)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        return await probe_video(path)
    except Exception as exc:
        logger.exception("Error probing video")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/stream")
async def stream_video(path: str = Query(..., description="Video file path")):
    """Stream a video file for playback."""
    error = validate_video_file(path)
    if error:
        raise HTTPException(status_code=400, detail=error)

    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "video/mp4"

    return FileResponse(
        path,
        media_type=mime,
        filename=Path(path).name,
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/thumbnails")
async def video_thumbnails(
    path: str = Query(..., description="Video file path"),
    count: int = Query(100, ge=10, le=500),
):
    """Generate thumbnail strip for timeline display."""
    error = validate_video_file(path)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        thumbs = await generate_thumbnails(path, count)
        return {"thumbnails": thumbs, "count": len(thumbs)}
    except Exception as exc:
        logger.exception("Error generating thumbnails")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/waveform")
async def video_waveform(
    path: str = Query(..., description="Video file path"),
    samples: int = Query(1000, ge=100, le=10000),
):
    """Generate audio waveform data for timeline display."""
    error = validate_video_file(path)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        data = await generate_waveform(path, samples)
        return {"waveform": data, "samples": len(data)}
    except Exception as exc:
        logger.exception("Error generating waveform")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/keyframes")
async def video_keyframes(path: str = Query(..., description="Video file path")):
    """Get keyframe timestamps for a video."""
    error = validate_video_file(path)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        kf = await get_keyframes(path)
        return {"keyframes": kf, "count": len(kf)}
    except Exception as exc:
        logger.exception("Error extracting keyframes")
        raise HTTPException(status_code=500, detail=str(exc))
