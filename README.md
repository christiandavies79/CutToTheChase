# CutToTheChase

A web-based video trimming tool for removing unwanted sections from videos while preserving original format, resolution, codec, and quality. Runs in a Docker container with optional NVIDIA GPU acceleration.

## Features

- **File Browser** — Navigate mounted media directories to select videos
- **Visual Timeline Editor** — Zoomable timeline with drag-to-select removal ranges
- **Audio Waveform** — Visual waveform display to help identify sections
- **Frame-Accurate Seeking** — Navigate frame-by-frame with keyboard shortcuts
- **Dual Cutting Modes** — Lossless (keyframe-only, default) or frame-accurate (minimal re-encoding)
- **Non-Destructive Editing** — Preview changes in real-time; nothing saved until you choose to
- **Undo/Redo** — Full undo/redo support for all range operations
- **GPU Acceleration** — Optional NVIDIA GPU passthrough for faster re-encoding
- **Dark Theme** — Modern dark UI optimized for low-light viewing

## Supported Formats

MP4, MKV, AVI, MOV, WebM, WMV, FLV, M4V, MPG, MPEG, TS, VOB, 3GP, OGV (via FFmpeg)

## Quick Start

### Docker Run

```bash
docker run -d \
  --name cuttothechase \
  -p 8080:8080 \
  -v /path/to/your/media:/media \
  dpooper79/cuttothechase:latest
```

Then open `http://localhost:8080` in your browser.

### Docker Compose

1. Edit `docker-compose.yml` and set your media volume path:
   ```yaml
   volumes:
     - /path/to/your/media:/media
   ```

2. Start the container:
   ```bash
   docker-compose up -d
   ```

### With NVIDIA GPU Acceleration

For systems with NVIDIA GPUs and [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed:

```bash
docker run -d \
  --name cuttothechase \
  --runtime=nvidia \
  -e NVIDIA_VISIBLE_DEVICES=all \
  -e NVIDIA_DRIVER_CAPABILITIES=compute,video,utility \
  -p 8080:8080 \
  -v /path/to/your/media:/media \
  dpooper79/cuttothechase:latest
```

Or via Docker Compose with the GPU profile:
```bash
docker-compose --profile gpu up -d
```

### Unraid Setup

1. Install the **Nvidia-Driver** plugin from Community Applications
2. Add the container from Docker Hub: `dpooper79/cuttothechase`
3. Configure:
   - **Port**: 8080 → 8080
   - **Volume**: `/mnt/user/your-media` → `/media`
   - **Extra Parameters**: `--runtime=nvidia`
   - **Environment Variables**:
     - `NVIDIA_VISIBLE_DEVICES=all`
     - `NVIDIA_DRIVER_CAPABILITIES=compute,video,utility`

## Usage

### Basic Workflow

1. **Browse** — Use the left panel to navigate to your video files
2. **Select** — Click a video file to load it in the editor
3. **Mark Ranges** — Drag on the timeline to mark sections for removal, or use I/O keys
4. **Preview** — Play the video; removed sections are automatically skipped
5. **Save** — Click "Save" (overwrite) or "Save As" (new file) when satisfied

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `J` | Skip back 10 seconds |
| `L` | Skip forward 10 seconds |
| `Left Arrow` | Skip back 5 seconds |
| `Right Arrow` | Skip forward 5 seconds |
| `Shift + Left` | Previous frame |
| `Shift + Right` | Next frame |
| `I` | Set mark-in point |
| `O` | Set mark-out point (creates removal range) |
| `Delete` / `Backspace` | Delete selected range |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |
| `Ctrl + Scroll` | Zoom timeline |

### Cutting Modes

- **Lossless (default)** — Uses stream copy (`-c copy`). Cuts are aligned to the nearest keyframe. Fastest option with zero quality loss.
- **Frame-accurate** — Re-encodes only the segments at cut points for precise cutting. Slightly slower with minimal quality impact at cut boundaries. Uses NVIDIA hardware encoding when available.

The cutting mode preference is saved in your browser and persists across sessions.

## Architecture

```
CutToTheChase/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── main.py          # FastAPI application entry point
│   │   ├── routes/
│   │   │   ├── files.py     # File browser API
│   │   │   ├── video.py     # Video info, streaming, thumbnails, waveform
│   │   │   └── processing.py# Trim processing with WebSocket progress
│   │   ├── services/
│   │   │   ├── ffmpeg.py    # FFmpeg wrapper for all video operations
│   │   │   └── file_manager.py # File system operations
│   │   └── models/
│   │       └── schemas.py   # Pydantic models
│   └── requirements.txt
├── frontend/                # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx          # Main application layout
│   │   ├── components/
│   │   │   ├── FileBrowser.tsx   # File navigation panel
│   │   │   ├── VideoPlayer.tsx   # Video playback with controls
│   │   │   ├── Waveform.tsx      # Audio waveform visualization
│   │   │   ├── Timeline.tsx      # Interactive editing timeline
│   │   │   ├── Toolbar.tsx       # Action bar with mode/save controls
│   │   │   └── SaveDialog.tsx    # Save completion dialog
│   │   ├── stores/
│   │   │   └── editorStore.ts    # Zustand state management
│   │   └── types/
│   │       └── index.ts          # TypeScript type definitions
│   └── vite.config.ts
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # Compose config with GPU profile
└── .github/workflows/
    └── docker-publish.yml   # CI/CD pipeline
```

### Tech Stack

- **Backend**: Python 3.12 with FastAPI — async HTTP/WebSocket, FFmpeg subprocess management
- **Frontend**: React 18 with TypeScript, Vite build tool, Zustand state management
- **Processing**: FFmpeg for all video operations (probe, thumbnail, waveform, trim)
- **Container**: Multi-stage Docker build, Debian-based with FFmpeg

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/files/browse?path=` | List directory contents |
| `GET` | `/api/video/info?path=` | Get video metadata |
| `GET` | `/api/video/stream?path=` | Stream video for playback |
| `GET` | `/api/video/thumbnails?path=&count=` | Generate timeline thumbnails |
| `GET` | `/api/video/waveform?path=&samples=` | Generate audio waveform data |
| `GET` | `/api/video/keyframes?path=` | Get keyframe timestamps |
| `POST` | `/api/process/trim` | Validate trim request |
| `WS` | `/api/process/ws/trim` | WebSocket for trim with progress |
| `POST` | `/api/process/cancel/{job_id}` | Cancel active trim job |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MEDIA_ROOT` | `/media` | Root directory for file browsing |
| `STATIC_DIR` | `/app/frontend/dist` | Frontend static files directory |

## Constraints

- Maximum file size: **10 GB**
- Optimized for **Chromium-based browsers** (Chrome, Edge)
- Files are restricted to the mounted media directory (path traversal prevention)
- No undo after save completion

## Development

### Local Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

### Build Docker Image

```bash
docker build -t cuttothechase .
docker run -p 8080:8080 -v /your/media:/media cuttothechase
```

## License

MIT
