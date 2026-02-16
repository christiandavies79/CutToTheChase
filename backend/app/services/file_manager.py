"""File system operations for browsing and managing media files."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from ..models.schemas import DirectoryListing, FileEntry

logger = logging.getLogger(__name__)

# Base media directory mounted into the container
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/media")

# Maximum file size: 10 GB
MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024

# Supported video extensions
VIDEO_EXTENSIONS = {
    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".wmv", ".flv",
    ".m4v", ".mpg", ".mpeg", ".ts", ".vob", ".3gp", ".ogv",
}


def _is_safe_path(path: str) -> bool:
    """Ensure the path stays within the media root."""
    try:
        resolved = os.path.realpath(path)
        root = os.path.realpath(MEDIA_ROOT)
        return resolved.startswith(root)
    except (ValueError, OSError):
        return False


def is_video_file(path: str) -> bool:
    """Check if a file has a recognized video extension."""
    return Path(path).suffix.lower() in VIDEO_EXTENSIONS


def validate_video_file(path: str) -> str | None:
    """Validate a video file path. Returns an error message or None if valid."""
    if not _is_safe_path(path):
        return "Access denied: path is outside the media directory."
    if not os.path.isfile(path):
        return "File not found."
    if not is_video_file(path):
        return "Unsupported file format."
    size = os.path.getsize(path)
    if size > MAX_FILE_SIZE:
        return f"File exceeds the 10 GB limit ({size / (1024**3):.1f} GB)."
    if size == 0:
        return "File is empty."
    return None


def list_directory(path: str | None = None) -> DirectoryListing:
    """List the contents of a directory under the media root."""
    if path is None:
        path = MEDIA_ROOT

    if not _is_safe_path(path):
        raise PermissionError("Access denied: path is outside the media directory.")

    if not os.path.isdir(path):
        raise FileNotFoundError(f"Directory not found: {path}")

    entries: list[FileEntry] = []
    try:
        for name in sorted(os.listdir(path)):
            full = os.path.join(path, name)
            # Skip hidden files
            if name.startswith("."):
                continue
            try:
                stat = os.stat(full)
                is_dir = os.path.isdir(full)
                ext = Path(name).suffix.lower() if not is_dir else None

                # Only show directories and video files
                if not is_dir and ext not in VIDEO_EXTENSIONS:
                    continue

                entries.append(FileEntry(
                    name=name,
                    path=full,
                    is_dir=is_dir,
                    size=stat.st_size if not is_dir else None,
                    modified=stat.st_mtime,
                    extension=ext,
                ))
            except OSError as exc:
                logger.warning("Cannot stat %s: %s", full, exc)
    except PermissionError:
        raise PermissionError(f"Cannot read directory: {path}")

    # Compute parent (but not above media root)
    parent = None
    real_path = os.path.realpath(path)
    real_root = os.path.realpath(MEDIA_ROOT)
    if real_path != real_root:
        parent = str(Path(real_path).parent)

    return DirectoryListing(path=real_path, parent=parent, entries=entries)
