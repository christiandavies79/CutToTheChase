/**
 * Interactive timeline component for managing removal ranges.
 * Supports zooming, clicking to seek, dragging to create/resize ranges,
 * and visual differentiation between kept and removed sections.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useEditorStore } from "../stores/editorStore";

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type DragMode = "none" | "creating" | "moving" | "resize-left" | "resize-right" | "seeking";

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const videoInfo = useEditorStore((s) => s.videoInfo);
  const currentTime = useEditorStore((s) => s.currentTime);
  const removalRanges = useEditorStore((s) => s.removalRanges);
  const selectedRangeId = useEditorStore((s) => s.selectedRangeId);
  const thumbnails = useEditorStore((s) => s.thumbnails);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setZoomLevel = useEditorStore((s) => s.setZoomLevel);
  const addRange = useEditorStore((s) => s.addRange);
  const updateRange = useEditorStore((s) => s.updateRange);
  const selectRange = useEditorStore((s) => s.selectRange);
  const removeRange = useEditorStore((s) => s.removeRange);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragStart, setDragStart] = useState(0);
  const [dragRangeId, setDragRangeId] = useState<string | null>(null);
  const [dragOriginal, setDragOriginal] = useState<{ start: number; end: number } | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  if (!videoInfo) return null;

  const duration = videoInfo.duration;

  const xToTime = (x: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    return ratio * (duration / zoomLevel);
  };

  const timeToPercent = (t: number): number => {
    return (t / duration) * 100 * zoomLevel;
  };

  // Mouse handlers for the track area
  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const time = xToTime(e.clientX);

    // Check if clicking on an existing range handle or body
    // (handled by individual range elements below)

    // Otherwise, start creating a new range
    setDragMode("creating");
    setDragStart(time);
    selectRange(null);
    e.preventDefault();
  };

  const handleRangeMouseDown = (e: React.MouseEvent, rangeId: string, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const range = removalRanges.find((r) => r.id === rangeId);
    if (!range) return;

    selectRange(rangeId);
    setDragMode(mode);
    setDragRangeId(rangeId);
    setDragOriginal({ start: range.start, end: range.end });
    setDragStart(xToTime(e.clientX));
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const time = xToTime(e.clientX);
      setHoverTime(time);

      if (dragMode === "creating") {
        // Visual feedback is handled in render
      } else if (dragMode === "moving" && dragRangeId && dragOriginal) {
        const delta = time - dragStart;
        const newStart = Math.max(0, dragOriginal.start + delta);
        const newEnd = Math.min(duration, dragOriginal.end + delta);
        if (newEnd - newStart > 0.1) {
          updateRange(dragRangeId, newStart, newEnd);
        }
      } else if (dragMode === "resize-left" && dragRangeId && dragOriginal) {
        const newStart = Math.max(0, Math.min(time, dragOriginal.end - 0.1));
        updateRange(dragRangeId, newStart, dragOriginal.end);
      } else if (dragMode === "resize-right" && dragRangeId && dragOriginal) {
        const newEnd = Math.min(duration, Math.max(time, dragOriginal.start + 0.1));
        updateRange(dragRangeId, dragOriginal.start, newEnd);
      }
    },
    [dragMode, dragRangeId, dragOriginal, dragStart, duration, updateRange]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (dragMode === "creating") {
        const endTime = xToTime(e.clientX);
        const rangeStart = Math.min(dragStart, endTime);
        const rangeEnd = Math.max(dragStart, endTime);
        if (rangeEnd - rangeStart > 0.2) {
          addRange(rangeStart, rangeEnd);
        } else {
          // Click to seek
          const video = document.querySelector("video");
          if (video) {
            video.currentTime = dragStart;
            setCurrentTime(dragStart);
          }
        }
      }
      setDragMode("none");
      setDragRangeId(null);
      setDragOriginal(null);
    },
    [dragMode, dragStart, addRange, setCurrentTime]
  );

  useEffect(() => {
    if (dragMode !== "none") {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      setZoomLevel(zoomLevel + delta);
    }
  };

  // Generate time markers
  const markers: { time: number; label: string }[] = [];
  const markerInterval = duration <= 60 ? 5 : duration <= 600 ? 30 : duration <= 3600 ? 60 : 300;
  for (let t = 0; t <= duration; t += markerInterval) {
    markers.push({ time: t, label: formatTimecode(t) });
  }

  // Thumbnail strip
  const thumbWidth = thumbnails.length > 0 ? 100 / thumbnails.length : 0;

  return (
    <div className="timeline" ref={containerRef} onWheel={handleWheel}>
      {/* Time markers */}
      <div className="tl-markers">
        {markers.map((m) => (
          <div
            key={m.time}
            className="tl-marker"
            style={{ left: `${timeToPercent(m.time)}%` }}
          >
            <span className="tl-marker-label text-xs font-mono">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Thumbnail strip */}
      {thumbnails.length > 0 && (
        <div className="tl-thumbstrip">
          {thumbnails.map((thumb, i) => (
            <img
              key={i}
              src={thumb}
              alt=""
              className="tl-thumb"
              style={{ width: `${thumbWidth}%` }}
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* Interactive track */}
      <div
        className="tl-track"
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
        onMouseMove={(e) => setHoverTime(xToTime(e.clientX))}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* Range blocks */}
        {removalRanges.map((range) => (
          <div
            key={range.id}
            className={`tl-range ${selectedRangeId === range.id ? "tl-range-selected" : ""}`}
            style={{
              left: `${timeToPercent(range.start)}%`,
              width: `${timeToPercent(range.end) - timeToPercent(range.start)}%`,
            }}
            onMouseDown={(e) => handleRangeMouseDown(e, range.id, "moving")}
          >
            {/* Resize handles */}
            <div
              className="tl-handle tl-handle-left"
              onMouseDown={(e) => handleRangeMouseDown(e, range.id, "resize-left")}
            />
            <div
              className="tl-handle tl-handle-right"
              onMouseDown={(e) => handleRangeMouseDown(e, range.id, "resize-right")}
            />
            {/* Delete button */}
            <button
              className="tl-range-delete"
              onClick={(e) => {
                e.stopPropagation();
                removeRange(range.id);
              }}
              title="Remove range (Delete)"
            >
              &times;
            </button>
          </div>
        ))}

        {/* Creation preview */}
        {dragMode === "creating" && hoverTime !== null && (
          <div
            className="tl-range tl-range-preview"
            style={{
              left: `${timeToPercent(Math.min(dragStart, hoverTime))}%`,
              width: `${Math.abs(timeToPercent(hoverTime) - timeToPercent(dragStart))}%`,
            }}
          />
        )}

        {/* Playhead */}
        <div
          className="tl-playhead"
          style={{ left: `${timeToPercent(currentTime)}%` }}
        >
          <div className="tl-playhead-head" />
          <div className="tl-playhead-line" />
        </div>

        {/* Hover indicator */}
        {hoverTime !== null && dragMode === "none" && (
          <div className="tl-hover" style={{ left: `${timeToPercent(hoverTime)}%` }}>
            <span className="tl-hover-time font-mono text-xs">{formatTimecode(hoverTime)}</span>
          </div>
        )}
      </div>

      {/* Zoom info */}
      <div className="tl-zoom-info text-xs text-muted">
        Zoom: {zoomLevel.toFixed(1)}x (Ctrl+Scroll)
      </div>

      <style>{`
        .timeline {
          position: relative;
          user-select: none;
          padding-bottom: 4px;
        }

        .tl-markers {
          position: relative;
          height: 20px;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }
        .tl-marker {
          position: absolute;
          top: 0;
          height: 100%;
          border-left: 1px solid var(--border-light);
        }
        .tl-marker-label {
          position: absolute;
          top: 2px;
          left: 4px;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .tl-thumbstrip {
          display: flex;
          height: 40px;
          overflow: hidden;
          opacity: 0.6;
        }
        .tl-thumb {
          height: 100%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .tl-track {
          position: relative;
          height: 48px;
          background: var(--bg-tertiary);
          cursor: crosshair;
          overflow: hidden;
        }

        /* Removal range */
        .tl-range {
          position: absolute;
          top: 0;
          height: 100%;
          background: var(--range-remove);
          border-left: 2px solid var(--range-remove-border);
          border-right: 2px solid var(--range-remove-border);
          cursor: grab;
          z-index: 2;
          transition: background 0.1s;
        }
        .tl-range:hover,
        .tl-range-selected {
          background: rgba(224, 85, 85, 0.45);
        }
        .tl-range-preview {
          background: rgba(224, 85, 85, 0.2);
          border-color: rgba(224, 85, 85, 0.5);
          pointer-events: none;
          z-index: 1;
        }

        .tl-handle {
          position: absolute;
          top: 0;
          width: 8px;
          height: 100%;
          cursor: ew-resize;
          z-index: 3;
        }
        .tl-handle-left { left: -4px; }
        .tl-handle-right { right: -4px; }

        .tl-range-delete {
          position: absolute;
          top: 2px;
          right: 4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--danger);
          color: #fff;
          font-size: 14px;
          line-height: 1;
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 4;
        }
        .tl-range:hover .tl-range-delete,
        .tl-range-selected .tl-range-delete {
          display: inline-flex;
        }
        .tl-range-delete:hover {
          background: var(--danger-hover);
        }

        /* Playhead */
        .tl-playhead {
          position: absolute;
          top: 0;
          height: 100%;
          z-index: 10;
          pointer-events: none;
          transform: translateX(-1px);
        }
        .tl-playhead-head {
          width: 10px;
          height: 10px;
          background: #fff;
          transform: translateX(-4px);
          clip-path: polygon(0 0, 100% 0, 50% 100%);
        }
        .tl-playhead-line {
          width: 2px;
          height: calc(100% - 10px);
          background: #fff;
        }

        /* Hover */
        .tl-hover {
          position: absolute;
          top: 0;
          height: 100%;
          border-left: 1px dashed rgba(255, 255, 255, 0.3);
          pointer-events: none;
          z-index: 5;
        }
        .tl-hover-time {
          position: absolute;
          bottom: 100%;
          left: 4px;
          background: var(--bg-primary);
          padding: 1px 4px;
          border-radius: 2px;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .tl-zoom-info {
          position: absolute;
          bottom: 6px;
          right: 8px;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
