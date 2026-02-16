/**
 * Audio waveform visualization component.
 * Displays the audio waveform below the video player, synchronized with the timeline.
 */

import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "../stores/editorStore";

export default function Waveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const waveformData = useEditorStore((s) => s.waveformData);
  const isLoading = useEditorStore((s) => s.isLoadingWaveform);
  const videoInfo = useEditorStore((s) => s.videoInfo);
  const currentTime = useEditorStore((s) => s.currentTime);
  const removalRanges = useEditorStore((s) => s.removalRanges);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const scrollPosition = useEditorStore((s) => s.scrollPosition);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !videoInfo || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width * zoomLevel;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#16161e";
    ctx.fillRect(0, 0, w, h);

    const duration = videoInfo.duration;
    const pxPerSec = w / duration;
    const midY = h / 2;
    const maxAmp = h * 0.45;

    // Draw removal ranges
    for (const range of removalRanges) {
      const x1 = range.start * pxPerSec;
      const x2 = range.end * pxPerSec;
      ctx.fillStyle = "rgba(224, 85, 85, 0.15)";
      ctx.fillRect(x1, 0, x2 - x1, h);
    }

    // Draw waveform bars
    const barWidth = Math.max(1, w / waveformData.length - 0.5);
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * w;
      const amp = Math.abs(waveformData[i]) * maxAmp;
      const time = (i / waveformData.length) * duration;

      // Check if this sample falls in a removal range
      let inRemoval = false;
      for (const range of removalRanges) {
        if (time >= range.start && time < range.end) {
          inRemoval = true;
          break;
        }
      }

      ctx.fillStyle = inRemoval ? "rgba(224, 85, 85, 0.4)" : "rgba(59, 130, 196, 0.6)";
      ctx.fillRect(x, midY - amp, barWidth, amp * 2);
    }

    // Center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Playhead
    const playheadX = currentTime * pxPerSec;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();
  }, [waveformData, videoInfo, currentTime, removalRanges, zoomLevel]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  if (!videoInfo) return null;

  return (
    <div className="waveform-container" ref={containerRef}>
      {isLoading ? (
        <div className="waveform-loading text-xs text-muted">Loading waveform...</div>
      ) : waveformData.length === 0 ? (
        <div className="waveform-loading text-xs text-muted">No audio</div>
      ) : (
        <div className="waveform-scroll" style={{ overflowX: zoomLevel > 1 ? "auto" : "hidden" }}>
          <canvas ref={canvasRef} />
        </div>
      )}

      <style>{`
        .waveform-container {
          height: 60px;
          position: relative;
          background: #16161e;
          border-bottom: 1px solid var(--border);
        }
        .waveform-scroll {
          width: 100%;
          height: 100%;
        }
        .waveform-scroll canvas {
          display: block;
        }
        .waveform-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
