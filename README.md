1. Project Overview
The application is a web-based video trimming tool focused on removing unwanted sections from videos (beginning, end, or middle) while preserving the original format, resolution, codec, and quality. Edits involve segment-based removal, with users visually marking sections for deletion. No changes are committed until the user selects “Save” or “Save As.” The tool prioritizes efficiency for videos ranging from short (≤10 minutes) to long (4–5 hours).
The application runs in a Docker container with optional NVIDIA GPU passthrough for acceleration. It includes a file-browser interface for selecting videos from mounted media directories and features a modern, dark-themed user interface optimized for low-light viewing.
2. Core Functional Requirements
2.1 Video Loading and Navigation

File explorer interface for browsing mounted directories (e.g., /media).
Support for common containers (MP4, MKV, AVI, MOV, WebM, etc.) via FFmpeg.
Efficient streaming and thumbnail/waveform generation to handle short and long videos responsively.
Reject files exceeding 10 GB with a clear error message; provide graceful handling for other edge cases (e.g., unsupported formats, corrupted files).

2.2 Visual Editing Interface

Embedded video player with frame-accurate seeking and playback controls.
Audio waveform display below the timeline to aid in identifying sections.
Zoomable timeline supporting multiple non-overlapping range selections for removal.
Visual differentiation: retained sections in solid color; removed sections faded or marked.
Real-time playback that automatically skips removed sections (no temporary file generation).

2.3 Edit Management

Add, resize, move, or delete removal ranges via mouse drag or keyboard shortcuts.
Undo/redo for range operations during the session.
All audio tracks and subtitles preserved exactly as in the source file.

2.4 Cutting Mode Selection

User-configurable option: “Lossless (keyframe-only)” or “Frame-accurate (minimal re-encoding).”
Default: Lossless (keyframe-only) using -c copy for true preservation.
Frame-accurate mode: re-encode only affected segments when cuts fall between keyframes, with a clear warning about potential minor quality impact.

Preference stored (e.g., via browser local storage) and applied across sessions.

2.5 Saving

“Save”: overwrite original after confirmation.
“Save As”: prompt for new filename/location.
Processing via FFmpeg with stream copy where possible; concatenate retained segments.
Progress indicator with cancellation support.
No undo available after save completion.
Preserve original metadata (creation date, chapters, etc.) where feasible.

3. Non-Functional Requirements
3.1 Performance

Stream-based processing to limit memory usage.
GPU acceleration (NVIDIA) for decoding/encoding when re-encoding is required.
Responsive UI for multi-hour videos through efficient waveform/thumbnail caching.

3.2 Deployment

Single Docker container with static FFmpeg build.
Configurable media mount (e.g., -v /path/to/media:/media).
Support for NVIDIA runtime on Unraid.
Exposed web port (configurable, default 8080).
Comprehensive logging of FFmpeg output, application events, and errors to container logs for debugging.

3.3 Security and Reliability

Local-only operation; access restricted to mounted volumes.
Robust error handling (e.g., file size limits, format issues, processing interruptions).
Browser compatibility prioritized for Chromium-based browsers (Chrome, Edge).

4. User Interface and Experience

Dark modern theme (deep gray/black background, subtle blue/teal accents, high-contrast text).
Layout:
File browser panel (left or top).
Central video player and waveform.
Bottom editable timeline with range markers.
Toolbar for actions (including cutting mode checkbox, undo/redo, save buttons).

Keyboard shortcuts for efficiency (e.g., I/O for markers, Delete for range removal).
Clear, non-intrusive warnings and confirmations (e.g., overwrite, frame-accurate mode).

5. Technical Architecture (High-Level)

Frontend: React or Svelte; video.js/Plyr for playback; wavesurfer.js for waveform.
Backend: Node.js (Express) or Python (FastAPI) for file operations, FFmpeg execution, and WebSocket progress updates.
Processing: FFmpeg with fluent-ffmpeg/subprocess wrapper.
Container: Multi-stage Dockerfile including NVIDIA support.

6. Resolved Considerations
The following points from the previous draft have been incorporated or confirmed:

Lossless vs. frame-accurate cutting: Implemented as user-selectable option with persistent preference.
Preview: Real-time skipping during playback is sufficient; no rendered preview required.
Audio/multi-track: All audio tracks and subtitles preserved unchanged.
File size limits: 10 GB maximum enforced with error handling.
Post-save undo: Explicitly not supported.
Browser support: Optimized for Chromium-based browsers.
Logging: Directed to container logs.
