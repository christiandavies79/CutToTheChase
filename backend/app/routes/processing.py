"""Video processing (trim) routes with WebSocket progress updates."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..models.schemas import CuttingMode, TimeRange, TrimProgress, TrimRequest
from ..services.ffmpeg import cancel_job, probe_video, trim_video
from ..services.file_manager import validate_video_file, _is_safe_path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/process", tags=["processing"])

# Track active WebSocket connections per job
_ws_connections: dict[str, WebSocket] = {}


@router.post("/trim")
async def start_trim(request: TrimRequest):
    """Validate a trim request and return job parameters. Actual processing is done via WebSocket."""
    error = validate_video_file(request.source_path)
    if error:
        raise HTTPException(status_code=400, detail=error)

    if not _is_safe_path(request.output_path):
        raise HTTPException(status_code=403, detail="Output path is outside the media directory.")

    # Check if output already exists
    if os.path.exists(request.output_path) and not request.overwrite:
        raise HTTPException(
            status_code=409,
            detail="Output file already exists. Set overwrite=true or choose a different name."
        )

    if not request.removal_ranges:
        raise HTTPException(status_code=400, detail="No removal ranges specified.")

    return {"status": "ready", "message": "Connect to WebSocket to start processing."}


@router.websocket("/ws/trim")
async def ws_trim(websocket: WebSocket):
    """
    WebSocket endpoint for video trimming with real-time progress.

    Client sends a JSON message with the trim parameters, then receives
    progress updates until completion or error.
    """
    await websocket.accept()
    job_id: str | None = None

    try:
        # Receive trim request
        data = await websocket.receive_text()
        params = json.loads(data)

        source_path = params["source_path"]
        output_path = params["output_path"]
        removal_ranges = [TimeRange(**r) for r in params["removal_ranges"]]
        cutting_mode = CuttingMode(params.get("cutting_mode", "lossless"))
        overwrite = params.get("overwrite", False)

        # Validate
        error = validate_video_file(source_path)
        if error:
            await websocket.send_json({"status": "error", "message": error})
            await websocket.close()
            return

        if not _is_safe_path(output_path):
            await websocket.send_json({"status": "error", "message": "Output path outside media directory."})
            await websocket.close()
            return

        if os.path.exists(output_path) and not overwrite:
            await websocket.send_json({"status": "error", "message": "Output file already exists."})
            await websocket.close()
            return

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        # Get video duration for segment calculation
        info = await probe_video(source_path)

        async def progress_callback(progress: TrimProgress):
            try:
                await websocket.send_json(progress.model_dump())
            except Exception:
                pass

        # Run the trim
        result_path = await trim_video(
            source_path=source_path,
            output_path=output_path,
            removal_ranges=removal_ranges,
            cutting_mode=cutting_mode,
            duration=info.duration,
            progress_callback=progress_callback,
        )

        await websocket.send_json({
            "job_id": "",
            "status": "completed",
            "progress": 100,
            "message": "Trim completed successfully.",
            "output_path": result_path,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        if job_id:
            cancel_job(job_id)
    except json.JSONDecodeError:
        await websocket.send_json({"status": "error", "message": "Invalid JSON."})
    except Exception as exc:
        logger.exception("Trim error")
        try:
            await websocket.send_json({"status": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.post("/cancel/{job_id}")
async def cancel_trim(job_id: str):
    """Cancel an active trim job."""
    if cancel_job(job_id):
        return {"status": "cancelled", "job_id": job_id}
    raise HTTPException(status_code=404, detail="Job not found or already completed.")
