/** Shared types for the CutToTheChase frontend. */

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  modified: number | null;
  extension: string | null;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

export interface VideoInfo {
  path: string;
  filename: string;
  duration: number;
  width: number;
  height: number;
  codec: string;
  audio_codec: string | null;
  container: string;
  file_size: number;
  bitrate: number;
  fps: number;
  has_audio: boolean;
  audio_tracks: number;
  subtitle_tracks: number;
  keyframe_interval: number | null;
}

export interface RemovalRange {
  id: string;
  start: number;
  end: number;
}

export type CuttingMode = "lossless" | "frame_accurate";

export interface TrimProgress {
  job_id: string;
  status: "processing" | "completed" | "error" | "cancelled";
  progress: number;
  message: string;
  output_path?: string;
}

export interface EditorState {
  // File browser
  currentPath: string | null;
  directoryListing: DirectoryListing | null;
  isLoadingDir: boolean;

  // Video
  videoInfo: VideoInfo | null;
  videoUrl: string | null;
  isLoadingVideo: boolean;

  // Waveform
  waveformData: number[];
  isLoadingWaveform: boolean;

  // Thumbnails
  thumbnails: string[];
  isLoadingThumbnails: boolean;

  // Editing
  removalRanges: RemovalRange[];
  selectedRangeId: string | null;
  cuttingMode: CuttingMode;

  // Undo/redo
  undoStack: RemovalRange[][];
  redoStack: RemovalRange[][];

  // Timeline
  zoomLevel: number;
  scrollPosition: number;

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Processing
  trimProgress: TrimProgress | null;
  isTrimming: boolean;

  // Error
  error: string | null;
}
