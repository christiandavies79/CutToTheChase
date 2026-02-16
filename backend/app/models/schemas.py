"""Pydantic models for API request/response schemas."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CuttingMode(str, Enum):
    LOSSLESS = "lossless"
    FRAME_ACCURATE = "frame_accurate"


class TimeRange(BaseModel):
    """A time range marked for removal (in seconds)."""
    id: str
    start: float = Field(ge=0, description="Start time in seconds")
    end: float = Field(gt=0, description="End time in seconds")


class VideoInfo(BaseModel):
    """Metadata about a loaded video file."""
    path: str
    filename: str
    duration: float
    width: int
    height: int
    codec: str
    audio_codec: Optional[str] = None
    container: str
    file_size: int
    bitrate: int
    fps: float
    has_audio: bool
    audio_tracks: int = 0
    subtitle_tracks: int = 0
    keyframe_interval: Optional[float] = None


class FileEntry(BaseModel):
    """A file or directory entry for the file browser."""
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = None
    modified: Optional[float] = None
    extension: Optional[str] = None


class DirectoryListing(BaseModel):
    """Response for directory listing requests."""
    path: str
    parent: Optional[str] = None
    entries: list[FileEntry]


class TrimRequest(BaseModel):
    """Request to trim a video."""
    source_path: str
    output_path: str
    removal_ranges: list[TimeRange]
    cutting_mode: CuttingMode = CuttingMode.LOSSLESS
    overwrite: bool = False


class TrimProgress(BaseModel):
    """WebSocket message for trim progress updates."""
    job_id: str
    status: str  # "processing", "completed", "error", "cancelled"
    progress: float = Field(ge=0, le=100)
    message: str = ""
    output_path: Optional[str] = None


class ThumbnailRequest(BaseModel):
    """Request to generate thumbnails for a video."""
    path: str
    count: int = Field(default=100, ge=10, le=500)


class WaveformRequest(BaseModel):
    """Request to generate waveform data for a video."""
    path: str
    samples: int = Field(default=1000, ge=100, le=10000)
