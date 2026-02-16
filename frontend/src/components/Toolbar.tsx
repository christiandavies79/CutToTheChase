/**
 * Toolbar component with cutting mode toggle, undo/redo, save buttons,
 * and video information display.
 */

import { useState } from "react";
import { useEditorStore } from "../stores/editorStore";

export default function Toolbar() {
  const videoInfo = useEditorStore((s) => s.videoInfo);
  const removalRanges = useEditorStore((s) => s.removalRanges);
  const cuttingMode = useEditorStore((s) => s.cuttingMode);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const isTrimming = useEditorStore((s) => s.isTrimming);
  const trimProgress = useEditorStore((s) => s.trimProgress);

  const setCuttingMode = useEditorStore((s) => s.setCuttingMode);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const clearRanges = useEditorStore((s) => s.clearRanges);
  const closeVideo = useEditorStore((s) => s.closeVideo);
  const startTrim = useEditorStore((s) => s.startTrim);
  const cancelTrim = useEditorStore((s) => s.cancelTrim);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<"save" | "saveas">("save");

  if (!videoInfo) return null;

  const handleSave = () => {
    setSaveMode("save");
    setShowSaveDialog(true);
  };

  const handleSaveAs = () => {
    setSaveMode("saveas");
    setShowSaveDialog(true);
  };

  const confirmSave = (outputPath: string, overwrite: boolean) => {
    setShowSaveDialog(false);
    startTrim(outputPath, overwrite);
  };

  // Compute total removed time
  const removedTime = removalRanges.reduce((sum, r) => sum + (r.end - r.start), 0);

  return (
    <>
      <div className="toolbar">
        {/* Left: File info */}
        <div className="tb-section">
          <button className="tb-btn tb-close" onClick={closeVideo} title="Close video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <span className="tb-filename truncate" title={videoInfo.path}>
            {videoInfo.filename}
          </span>
          <span className="text-xs text-muted">
            {removalRanges.length} cut{removalRanges.length !== 1 ? "s" : ""}
            {removedTime > 0 && ` (${removedTime.toFixed(1)}s removed)`}
          </span>
        </div>

        {/* Center: Edit controls */}
        <div className="tb-section">
          <button
            className="tb-btn"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h13a4 4 0 010 8H7" /><path d="M3 10l4-4M3 10l4 4" />
            </svg>
          </button>
          <button
            className="tb-btn"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10H8a4 4 0 000 8h10" /><path d="M21 10l-4-4M21 10l-4 4" />
            </svg>
          </button>
          <div className="tb-separator" />
          <button
            className="tb-btn"
            onClick={clearRanges}
            disabled={removalRanges.length === 0}
            title="Clear all ranges"
          >
            Clear
          </button>
        </div>

        {/* Cutting mode */}
        <div className="tb-section">
          <label className="tb-mode" title={
            cuttingMode === "lossless"
              ? "Keyframe-aligned cuts, no re-encoding. Fastest and preserves quality."
              : "Frame-accurate cuts with minimal re-encoding. Slightly slower, minor quality impact at cut points."
          }>
            <input
              type="checkbox"
              checked={cuttingMode === "frame_accurate"}
              onChange={(e) => setCuttingMode(e.target.checked ? "frame_accurate" : "lossless")}
            />
            <span className="text-sm">Frame-accurate</span>
          </label>
        </div>

        {/* Right: Save buttons */}
        <div className="tb-section">
          {isTrimming ? (
            <div className="tb-progress">
              <div className="tb-progress-bar">
                <div
                  className="tb-progress-fill"
                  style={{ width: `${trimProgress?.progress || 0}%` }}
                />
              </div>
              <span className="text-xs">{trimProgress?.message || "Processing..."}</span>
              <button className="tb-btn tb-cancel" onClick={cancelTrim}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                className="tb-btn tb-save"
                onClick={handleSave}
                disabled={removalRanges.length === 0}
                title="Save (overwrite original)"
              >
                Save
              </button>
              <button
                className="tb-btn tb-saveas"
                onClick={handleSaveAs}
                disabled={removalRanges.length === 0}
                title="Save As (new file)"
              >
                Save As
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save confirmation dialog */}
      {showSaveDialog && (
        <SaveConfirmDialog
          videoInfo={videoInfo}
          mode={saveMode}
          cuttingMode={cuttingMode}
          onConfirm={confirmSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      <style>{`
        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .tb-section {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tb-section:last-child {
          margin-left: auto;
        }
        .tb-separator {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 4px;
        }
        .tb-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 13px;
          color: var(--text-secondary);
          transition: all 0.1s;
        }
        .tb-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .tb-close:hover:not(:disabled) {
          background: var(--danger);
          color: #fff;
        }
        .tb-filename {
          font-weight: 500;
          max-width: 200px;
        }
        .tb-mode {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: var(--text-secondary);
        }
        .tb-mode input {
          accent-color: var(--accent);
        }
        .tb-save {
          background: var(--accent);
          color: #fff;
        }
        .tb-save:hover:not(:disabled) {
          background: var(--accent-hover);
          color: #fff;
        }
        .tb-saveas {
          border: 1px solid var(--border);
        }
        .tb-cancel {
          color: var(--danger);
        }
        .tb-cancel:hover {
          background: var(--danger);
          color: #fff;
        }
        .tb-progress {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tb-progress-bar {
          width: 120px;
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }
        .tb-progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s;
          border-radius: 3px;
        }
      `}</style>
    </>
  );
}

/* Inline save confirmation dialog */
function SaveConfirmDialog({
  videoInfo,
  mode,
  cuttingMode,
  onConfirm,
  onCancel,
}: {
  videoInfo: { path: string; filename: string };
  mode: "save" | "saveas";
  cuttingMode: string;
  onConfirm: (path: string, overwrite: boolean) => void;
  onCancel: () => void;
}) {
  const [outputPath, setOutputPath] = useState(() => {
    if (mode === "save") return videoInfo.path;
    // Generate a default "save as" path
    const parts = videoInfo.path.split(".");
    const ext = parts.pop();
    return `${parts.join(".")}_trimmed.${ext}`;
  });

  const isOverwrite = mode === "save";

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "save" ? "Save (Overwrite)" : "Save As"}</h3>

        {mode === "save" && (
          <p className="dialog-warning">
            This will overwrite the original file. This action cannot be undone.
          </p>
        )}

        {cuttingMode === "frame_accurate" && (
          <p className="dialog-info">
            Frame-accurate mode: segments at cut points will be minimally re-encoded.
            This may cause slight quality differences at those points.
          </p>
        )}

        <label className="dialog-label">
          Output path:
          <input
            type="text"
            className="dialog-input"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            readOnly={mode === "save"}
          />
        </label>

        <div className="dialog-actions">
          <button className="dialog-btn dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`dialog-btn ${isOverwrite ? "dialog-danger" : "dialog-confirm"}`}
            onClick={() => onConfirm(outputPath, isOverwrite)}
            disabled={!outputPath.trim()}
          >
            {isOverwrite ? "Overwrite" : "Save"}
          </button>
        </div>

        <style>{`
          .dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .dialog {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px;
            width: 480px;
            max-width: 90vw;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          }
          .dialog h3 {
            margin-bottom: 12px;
            font-size: 16px;
          }
          .dialog-warning {
            color: var(--danger);
            font-size: 13px;
            margin-bottom: 12px;
            padding: 8px 12px;
            background: rgba(224, 85, 85, 0.1);
            border: 1px solid rgba(224, 85, 85, 0.3);
            border-radius: 4px;
          }
          .dialog-info {
            color: var(--warning);
            font-size: 13px;
            margin-bottom: 12px;
            padding: 8px 12px;
            background: rgba(234, 179, 8, 0.1);
            border: 1px solid rgba(234, 179, 8, 0.3);
            border-radius: 4px;
          }
          .dialog-label {
            display: block;
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 16px;
          }
          .dialog-input {
            display: block;
            width: 100%;
            margin-top: 6px;
            font-family: var(--font-mono);
            font-size: 12px;
          }
          .dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
          .dialog-btn {
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
          }
          .dialog-cancel {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
          }
          .dialog-cancel:hover {
            background: var(--bg-hover);
          }
          .dialog-confirm {
            background: var(--accent);
            color: #fff;
          }
          .dialog-confirm:hover {
            background: var(--accent-hover);
          }
          .dialog-danger {
            background: var(--danger);
            color: #fff;
          }
          .dialog-danger:hover {
            background: var(--danger-hover);
          }
        `}</style>
      </div>
    </div>
  );
}
