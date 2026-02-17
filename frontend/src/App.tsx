import { useEffect, useCallback } from "react";
import { useEditorStore } from "./stores/editorStore";
import FileBrowser from "./components/FileBrowser";
import VideoPlayer from "./components/VideoPlayer";
import Waveform from "./components/Waveform";
import Timeline from "./components/Timeline";
import Toolbar from "./components/Toolbar";
import SaveDialog from "./components/SaveDialog";

export default function App() {
  const videoInfo = useEditorStore((s) => s.videoInfo);
  const isLoadingVideo = useEditorStore((s) => s.isLoadingVideo);
  const error = useEditorStore((s) => s.error);
  const setError = useEditorStore((s) => s.setError);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const removeRange = useEditorStore((s) => s.removeRange);
  const selectedRangeId = useEditorStore((s) => s.selectedRangeId);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRangeId) {
          e.preventDefault();
          removeRange(selectedRangeId);
        }
      }
    },
    [undo, redo, removeRange, selectedRangeId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-layout">
      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          <span className="error-icon">!</span>
          <span>{error}</span>
          <button className="error-close">&times;</button>
        </div>
      )}

      {/* Left panel: file browser */}
      <aside className="file-panel">
        <FileBrowser />
      </aside>

      {/* Main content */}
      <main className="main-panel">
        {videoInfo ? (
          <>
            <Toolbar />
            <div className="video-area">
              <VideoPlayer />
            </div>
            <div className="timeline-area">
              <Waveform />
              <Timeline />
            </div>
          </>
        ) : isLoadingVideo ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading video...</p>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <h2>CutToTheChase</h2>
            <p className="text-muted">Select a video file from the browser to start editing</p>
          </div>
        )}
      </main>

      <SaveDialog />

      <style>{`
        .app-layout {
          display: flex;
          height: 100%;
          overflow: hidden;
        }

        .file-panel {
          width: 280px;
          min-width: 220px;
          max-width: 400px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .main-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .video-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #000;
          min-height: 0;
        }

        .timeline-area {
          flex-shrink: 0;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .loading-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
        }
        .empty-icon {
          opacity: 0.3;
          margin-bottom: 8px;
        }
        .empty-state h2 {
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
        }

        /* Error toast */
        .error-toast {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--danger);
          color: #fff;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          animation: slideIn 0.2s ease;
        }
        .error-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0,0,0,0.2);
          font-weight: 700;
          font-size: 12px;
        }
        .error-close {
          color: #fff;
          font-size: 18px;
          line-height: 1;
          opacity: 0.7;
        }
        .error-close:hover { opacity: 1; }

        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
