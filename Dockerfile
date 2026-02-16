# CutToTheChase — Multi-stage Docker build
# Supports optional NVIDIA GPU passthrough for hardware-accelerated encoding.

# ============================================================
# Stage 1: Build the React frontend
# ============================================================
FROM node:20-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: Production image with Python backend + FFmpeg
# ============================================================
FROM python:3.12-slim AS production

LABEL maintainer="CutToTheChase"
LABEL org.opencontainers.image.title="CutToTheChase"
LABEL org.opencontainers.image.description="Web-based video trimming tool"

# Install FFmpeg (static build) and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Create default media mount point
RUN mkdir -p /media

# Environment variables
ENV MEDIA_ROOT=/media \
    STATIC_DIR=/app/frontend/dist \
    PYTHONUNBUFFERED=1

# Expose default port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

# Run the application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
