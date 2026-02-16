/**
 * Video player component with playback controls and frame-accurate seeking.
 * Automatically skips over removed sections during playback.
 */

import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "../stores/editorStore";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${f.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}.${f.toString().padStart(2, "0")}`;
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);

  const videoUrl = useEditorStore((s) => s.videoUrl);
  const videoInfo = useEditorStore((s) => s.videoInfo);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const removalRanges = useEditorStore((s) => s.removalRanges);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const addRange = useEditorStore((s) => s.addRange);

  // Mark in/out points
  const markInRef = useRef<number | null>(null);

  // Skip removed sections during playback
  const checkSkip = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const t = video.currentTime;
    for (const range of removalRanges) {
      if (t >= range.start && t < range.end) {
        video.currentTime = range.end;
        break;
      }
    }
    setCurrentTime(video.currentTime);
    animRef.current = requestAnimationFrame(checkSkip);
  }, [removalRanges, setCurrentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      animRef.current = requestAnimationFrame(checkSkip);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animRef.current);
    };
    const onSeeked = () => setCurrentTime(video.currentTime);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
      cancelAnimationFrame(animRef.current);
    };
  }, [checkSkip, setCurrentTime, setIsPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const seek = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration));
    setCurrentTime(video.currentTime);
  };

  const seekFrame = (frames: number) => {
    const video = videoRef.current;
    if (!video || !videoInfo) return;
    const frameDuration = 1 / videoInfo.fps;
    video.currentTime = Math.max(0, Math.min(video.currentTime + frames * frameDuration, video.duration));
    setCurrentTime(video.currentTime);
  };

  // Mark in (I key) / Mark out (O key) for quick range creation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "i":
          markInRef.current = video.currentTime;
          break;
        case "o":
          if (markInRef.current !== null) {
            addRange(markInRef.current, video.currentTime);
            markInRef.current = null;
          }
          break;
        case "arrowleft":
          e.preventDefault();
          if (e.shiftKey) seekFrame(-1);
          else seek(-5);
          break;
        case "arrowright":
          e.preventDefault();
          if (e.shiftKey) seekFrame(1);
          else seek(5);
          break;
        case "j":
          seek(-10);
          break;
        case "l":
          seek(10);
          break;
        case "k":
          togglePlay();
          break;
      }
    },
    [addRange]
  );

  if (!videoUrl) return null;

  return (
    <div className="video-player" onKeyDown={handleKeyDown} tabIndex={0}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="video-element"
        preload="auto"
      />

      {/* Controls overlay */}
      <div className="vp-controls">
        <div className="vp-controls-left">
          {/* Skip back */}
          <button className="vp-btn" onClick={() => seek(-10)} title="Back 10s (J)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.5 8L8.5 12l4 4" /><path d="M20 12a8 8 0 10-3 6.25" />
            </svg>
          </button>

          {/* Frame back */}
          <button className="vp-btn" onClick={() => seekFrame(-1)} title="Previous frame (Shift+Left)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 20L9 12l10-8v16z" /><line x1="5" y1="4" x2="5" y2="20" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button className="vp-btn vp-play" onClick={togglePlay} title="Play/Pause (Space)">
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          {/* Frame forward */}
          <button className="vp-btn" onClick={() => seekFrame(1)} title="Next frame (Shift+Right)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 4l10 8-10 8V4z" /><line x1="19" y1="4" x2="19" y2="20" />
            </svg>
          </button>

          {/* Skip forward */}
          <button className="vp-btn" onClick={() => seek(10)} title="Forward 10s (L)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11.5 16l4-4-4-4" /><path d="M4 12a8 8 0 103-6.25" />
            </svg>
          </button>
        </div>

        <div className="vp-time font-mono text-sm">
          {formatTime(currentTime)}
          {videoInfo && <span className="text-muted"> / {formatTime(videoInfo.duration)}</span>}
        </div>

        <div className="vp-controls-right">
          <span className="text-xs text-muted" title="Press I to set mark-in, O to set mark-out and create a removal range">
            I/O: Mark range
          </span>
          {videoInfo && (
            <span className="text-xs text-muted">
              {videoInfo.width}x{videoInfo.height} &middot; {videoInfo.codec}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .video-player {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          outline: none;
        }
        .video-element {
          flex: 1;
          width: 100%;
          min-height: 0;
          object-fit: contain;
          background: #000;
        }
        .vp-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: var(--bg-primary);
          border-top: 1px solid var(--border);
        }
        .vp-controls-left {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .vp-controls-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .vp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 6px;
          color: var(--text-secondary);
          transition: all 0.1s;
        }
        .vp-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .vp-play {
          width: 42px;
          height: 42px;
          color: var(--text-primary);
        }
        .vp-play:hover {
          background: var(--accent);
          color: #fff;
        }
        .vp-time {
          min-width: 160px;
        }
      `}</style>
    </div>
  );
}
