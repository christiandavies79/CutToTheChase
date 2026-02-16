/**
 * Save completion/status dialog.
 * Shows when a trim job finishes (success or error).
 */

import { useEditorStore } from "../stores/editorStore";

export default function SaveDialog() {
  const trimProgress = useEditorStore((s) => s.trimProgress);
  const isTrimming = useEditorStore((s) => s.isTrimming);

  // Only show the completion dialog when not actively trimming and we have a result
  if (isTrimming || !trimProgress) return null;
  if (trimProgress.status !== "completed" && trimProgress.status !== "error") return null;

  const dismiss = () => {
    useEditorStore.setState({ trimProgress: null });
  };

  return (
    <div className="save-overlay" onClick={dismiss}>
      <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
        {trimProgress.status === "completed" ? (
          <>
            <div className="save-icon save-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>Trim Complete</h3>
            <p className="text-sm text-muted">
              {trimProgress.output_path && <>Saved to: <code>{trimProgress.output_path}</code></>}
            </p>
          </>
        ) : (
          <>
            <div className="save-icon save-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <h3>Trim Failed</h3>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {trimProgress.message}
            </p>
          </>
        )}

        <button className="save-dismiss" onClick={dismiss}>
          Dismiss
        </button>

        <style>{`
          .save-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .save-dialog {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 32px;
            text-align: center;
            min-width: 320px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          }
          .save-dialog h3 {
            margin: 12px 0 8px;
            font-size: 18px;
          }
          .save-dialog code {
            font-family: var(--font-mono);
            font-size: 12px;
            background: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 3px;
          }
          .save-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 50%;
          }
          .save-success {
            background: rgba(34, 197, 94, 0.15);
            color: var(--success);
          }
          .save-error {
            background: rgba(224, 85, 85, 0.15);
            color: var(--danger);
          }
          .save-dismiss {
            margin-top: 20px;
            padding: 8px 24px;
            border-radius: 4px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            font-size: 13px;
          }
          .save-dismiss:hover {
            background: var(--bg-hover);
          }
        `}</style>
      </div>
    </div>
  );
}
