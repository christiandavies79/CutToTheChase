/**
 * Zustand store for the video editor state.
 * Manages file browsing, video loading, removal ranges, undo/redo, and trim jobs.
 */

import { create } from "zustand";
import { produce } from "immer";
import type {
  CuttingMode,
  DirectoryListing,
  EditorState,
  RemovalRange,
  TrimProgress,
  VideoInfo,
} from "../types";

const API_BASE = "/api";

// Restore cutting mode from localStorage
function loadCuttingMode(): CuttingMode {
  try {
    const stored = localStorage.getItem("cttc_cutting_mode");
    if (stored === "frame_accurate") return "frame_accurate";
  } catch {}
  return "lossless";
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

interface EditorActions {
  // File browser
  browseDirectory: (path?: string) => Promise<void>;

  // Video
  loadVideo: (path: string) => Promise<void>;
  closeVideo: () => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;

  // Ranges
  addRange: (start: number, end: number) => void;
  updateRange: (id: string, start: number, end: number) => void;
  removeRange: (id: string) => void;
  selectRange: (id: string | null) => void;
  clearRanges: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Timeline
  setZoomLevel: (z: number) => void;
  setScrollPosition: (s: number) => void;

  // Cutting mode
  setCuttingMode: (mode: CuttingMode) => void;

  // Processing
  startTrim: (outputPath: string, overwrite: boolean) => void;
  updateTrimProgress: (p: TrimProgress) => void;
  cancelTrim: () => void;
  reloadAfterTrim: () => Promise<void>;

  // Error
  setError: (err: string | null) => void;
}

type Store = EditorState & EditorActions;

export const useEditorStore = create<Store>()((set, get) => ({
  // Initial state
  currentPath: null,
  directoryListing: null,
  isLoadingDir: false,
  videoInfo: null,
  videoUrl: null,
  isLoadingVideo: false,
  waveformData: [],
  isLoadingWaveform: false,
  thumbnails: [],
  isLoadingThumbnails: false,
  removalRanges: [],
  selectedRangeId: null,
  cuttingMode: loadCuttingMode(),
  undoStack: [],
  redoStack: [],
  zoomLevel: 1,
  scrollPosition: 0,
  currentTime: 0,
  isPlaying: false,
  trimProgress: null,
  isTrimming: false,
  _trimOutputPath: null,
  _trimWasOverwrite: false,
  error: null,

  // === File Browser ===
  browseDirectory: async (path) => {
    set({ isLoadingDir: true, error: null });
    try {
      const url = path
        ? `${API_BASE}/files/browse?path=${encodeURIComponent(path)}`
        : `${API_BASE}/files/browse`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to browse directory.");
      }
      const listing: DirectoryListing = await res.json();
      set({ directoryListing: listing, currentPath: listing.path, isLoadingDir: false });
    } catch (err: any) {
      set({ isLoadingDir: false, error: err.message });
    }
  },

  // === Video Loading ===
  loadVideo: async (path) => {
    set({
      isLoadingVideo: true,
      isLoadingWaveform: true,
      isLoadingThumbnails: true,
      error: null,
      removalRanges: [],
      undoStack: [],
      redoStack: [],
      selectedRangeId: null,
      zoomLevel: 1,
      scrollPosition: 0,
      currentTime: 0,
    });
    try {
      // Get video info
      const infoRes = await fetch(
        `${API_BASE}/video/info?path=${encodeURIComponent(path)}`
      );
      if (!infoRes.ok) {
        const data = await infoRes.json();
        throw new Error(data.detail || "Failed to load video info.");
      }
      const info: VideoInfo = await infoRes.json();
      const videoUrl = `${API_BASE}/video/stream?path=${encodeURIComponent(path)}`;
      set({ videoInfo: info, videoUrl, isLoadingVideo: false });

      // Load waveform in background
      fetch(`${API_BASE}/video/waveform?path=${encodeURIComponent(path)}&samples=2000`)
        .then((r) => r.json())
        .then((data) => set({ waveformData: data.waveform || [], isLoadingWaveform: false }))
        .catch(() => set({ waveformData: [], isLoadingWaveform: false }));

      // Load thumbnails in background
      const thumbCount = Math.min(Math.max(Math.floor(info.duration / 2), 20), 200);
      fetch(
        `${API_BASE}/video/thumbnails?path=${encodeURIComponent(path)}&count=${thumbCount}`
      )
        .then((r) => r.json())
        .then((data) => set({ thumbnails: data.thumbnails || [], isLoadingThumbnails: false }))
        .catch(() => set({ thumbnails: [], isLoadingThumbnails: false }));
    } catch (err: any) {
      set({
        isLoadingVideo: false,
        isLoadingWaveform: false,
        isLoadingThumbnails: false,
        error: err.message,
      });
    }
  },

  closeVideo: () =>
    set({
      videoInfo: null,
      videoUrl: null,
      waveformData: [],
      thumbnails: [],
      removalRanges: [],
      undoStack: [],
      redoStack: [],
      selectedRangeId: null,
      currentTime: 0,
      isPlaying: false,
      zoomLevel: 1,
      scrollPosition: 0,
    }),

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),

  // === Range Management ===
  addRange: (start, end) => {
    const state = get();
    const newRange: RemovalRange = { id: generateId(), start: Math.min(start, end), end: Math.max(start, end) };

    // Validate no overlaps
    for (const r of state.removalRanges) {
      if (newRange.start < r.end && newRange.end > r.start) {
        set({ error: "Ranges cannot overlap." });
        return;
      }
    }

    set(
      produce<Store>((draft) => {
        draft.undoStack.push([...draft.removalRanges]);
        draft.redoStack = [];
        draft.removalRanges.push(newRange);
        draft.removalRanges.sort((a, b) => a.start - b.start);
        draft.selectedRangeId = newRange.id;
        draft.error = null;
      })
    );
  },

  updateRange: (id, start, end) => {
    const state = get();
    const s = Math.min(start, end);
    const e = Math.max(start, end);

    // Check overlaps with other ranges
    for (const r of state.removalRanges) {
      if (r.id === id) continue;
      if (s < r.end && e > r.start) {
        set({ error: "Ranges cannot overlap." });
        return;
      }
    }

    set(
      produce<Store>((draft) => {
        draft.undoStack.push([...draft.removalRanges]);
        draft.redoStack = [];
        const range = draft.removalRanges.find((r) => r.id === id);
        if (range) {
          range.start = s;
          range.end = e;
        }
        draft.removalRanges.sort((a, b) => a.start - b.start);
        draft.error = null;
      })
    );
  },

  removeRange: (id) =>
    set(
      produce<Store>((draft) => {
        draft.undoStack.push([...draft.removalRanges]);
        draft.redoStack = [];
        draft.removalRanges = draft.removalRanges.filter((r) => r.id !== id);
        if (draft.selectedRangeId === id) draft.selectedRangeId = null;
      })
    ),

  selectRange: (id) => set({ selectedRangeId: id }),

  clearRanges: () =>
    set(
      produce<Store>((draft) => {
        if (draft.removalRanges.length > 0) {
          draft.undoStack.push([...draft.removalRanges]);
          draft.redoStack = [];
          draft.removalRanges = [];
          draft.selectedRangeId = null;
        }
      })
    ),

  // === Undo / Redo ===
  undo: () =>
    set(
      produce<Store>((draft) => {
        const prev = draft.undoStack.pop();
        if (prev) {
          draft.redoStack.push([...draft.removalRanges]);
          draft.removalRanges = prev;
          draft.selectedRangeId = null;
        }
      })
    ),

  redo: () =>
    set(
      produce<Store>((draft) => {
        const next = draft.redoStack.pop();
        if (next) {
          draft.undoStack.push([...draft.removalRanges]);
          draft.removalRanges = next;
          draft.selectedRangeId = null;
        }
      })
    ),

  // === Timeline ===
  setZoomLevel: (z) => set({ zoomLevel: Math.max(1, Math.min(z, 100)) }),
  setScrollPosition: (s) => set({ scrollPosition: Math.max(0, s) }),

  // === Cutting Mode ===
  setCuttingMode: (mode) => {
    localStorage.setItem("cttc_cutting_mode", mode);
    set({ cuttingMode: mode });
  },

  // === Processing ===
  startTrim: (outputPath, overwrite) => {
    const state = get();
    if (!state.videoInfo || state.removalRanges.length === 0) return;

    set({ isTrimming: true, trimProgress: null, error: null });

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/process/ws/trim`);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          source_path: state.videoInfo!.path,
          output_path: outputPath,
          removal_ranges: state.removalRanges,
          cutting_mode: state.cuttingMode,
          overwrite,
        })
      );
    };

    ws.onmessage = (event) => {
      const progress: TrimProgress = JSON.parse(event.data);
      set({ trimProgress: progress });
      if (progress.status === "completed" || progress.status === "error" || progress.status === "cancelled") {
        set({
          isTrimming: false,
          // Store trim context so reloadAfterTrim knows what to do
          ...(progress.status === "completed" ? {
            _trimOutputPath: progress.output_path || outputPath,
            _trimWasOverwrite: overwrite,
          } : {}),
        });
        ws.close();
      }
    };

    ws.onerror = () => {
      set({ isTrimming: false, error: "WebSocket connection error." });
    };

    ws.onclose = () => {
      set((s) => (s.isTrimming ? { isTrimming: false } : {}));
    };

    // Store ws reference for cancellation
    (window as any).__cttc_ws = ws;
  },

  updateTrimProgress: (p) => set({ trimProgress: p }),

  cancelTrim: () => {
    const ws = (window as any).__cttc_ws as WebSocket | undefined;
    if (ws) {
      ws.close();
      (window as any).__cttc_ws = undefined;
    }
    set({ isTrimming: false, trimProgress: null });
  },

  // === Post-Trim Reload ===
  reloadAfterTrim: async () => {
    const state = get();
    const outputPath = state._trimOutputPath;
    const wasOverwrite = state._trimWasOverwrite;
    if (!outputPath) return;

    // Clear editing state and reset playback
    set({
      removalRanges: [],
      selectedRangeId: null,
      undoStack: [],
      redoStack: [],
      currentTime: 0,
      isPlaying: false,
      trimProgress: null,
      _trimOutputPath: null,
      _trimWasOverwrite: false,
      isLoadingVideo: true,
      isLoadingWaveform: true,
      isLoadingThumbnails: true,
    });

    try {
      // Reload video info from the output file
      const infoRes = await fetch(
        `${API_BASE}/video/info?path=${encodeURIComponent(outputPath)}`
      );
      if (!infoRes.ok) {
        const data = await infoRes.json();
        throw new Error(data.detail || "Failed to reload video info.");
      }
      const info: VideoInfo = await infoRes.json();

      // Bust browser cache with a timestamp query param
      const cacheBuster = `&_t=${Date.now()}`;
      const videoUrl = `${API_BASE}/video/stream?path=${encodeURIComponent(outputPath)}${cacheBuster}`;
      set({ videoInfo: info, videoUrl, isLoadingVideo: false });

      // Reload waveform in background
      fetch(`${API_BASE}/video/waveform?path=${encodeURIComponent(outputPath)}&samples=2000`)
        .then((r) => r.json())
        .then((data) => set({ waveformData: data.waveform || [], isLoadingWaveform: false }))
        .catch(() => set({ waveformData: [], isLoadingWaveform: false }));

      // Reload thumbnails in background
      const thumbCount = Math.min(Math.max(Math.floor(info.duration / 2), 20), 200);
      fetch(
        `${API_BASE}/video/thumbnails?path=${encodeURIComponent(outputPath)}&count=${thumbCount}`
      )
        .then((r) => r.json())
        .then((data) => set({ thumbnails: data.thumbnails || [], isLoadingThumbnails: false }))
        .catch(() => set({ thumbnails: [], isLoadingThumbnails: false }));

      // Refresh file browser (new file appears for Save As, updated size for overwrite)
      if (state.currentPath) {
        get().browseDirectory(state.currentPath);
      }
    } catch (err: any) {
      set({
        isLoadingVideo: false,
        isLoadingWaveform: false,
        isLoadingThumbnails: false,
        error: err.message,
      });
    }
  },

  // === Error ===
  setError: (err) => set({ error: err }),
}));
