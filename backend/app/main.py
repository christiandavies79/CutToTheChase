"""CutToTheChase — Web-based video trimming application."""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import files, processing, video

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cttc")

app = FastAPI(
    title="CutToTheChase",
    description="Web-based video trimming tool",
    version="1.0.0",
)

# CORS — allow all origins since this is a local-only tool
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(files.router)
app.include_router(video.router)
app.include_router(processing.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "app": "CutToTheChase", "version": "1.0.0"}


# Serve the React frontend in production
STATIC_DIR = os.environ.get("STATIC_DIR", "/app/frontend/dist")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
    logger.info("Serving frontend from %s", STATIC_DIR)
else:
    logger.info("No static frontend found at %s — API-only mode", STATIC_DIR)
