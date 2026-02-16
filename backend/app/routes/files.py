"""File browser API routes."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import DirectoryListing
from ..services.file_manager import list_directory

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/browse", response_model=DirectoryListing)
async def browse_directory(path: Optional[str] = Query(None, description="Directory path")):
    """List contents of a directory under the media root."""
    try:
        return list_directory(path)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("Error browsing directory")
        raise HTTPException(status_code=500, detail=str(exc))
