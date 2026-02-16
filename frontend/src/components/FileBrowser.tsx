/**
 * File browser panel for navigating mounted media directories.
 * Shows directories and video files, allowing users to select a video to edit.
 */

import { useEffect } from "react";
import { useEditorStore } from "../stores/editorStore";
import type { FileEntry } from "../types";

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.is_dir) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
        <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export default function FileBrowser() {
  const listing = useEditorStore((s) => s.directoryListing);
  const isLoading = useEditorStore((s) => s.isLoadingDir);
  const isLoadingVideo = useEditorStore((s) => s.isLoadingVideo);
  const browseDirectory = useEditorStore((s) => s.browseDirectory);
  const loadVideo = useEditorStore((s) => s.loadVideo);

  // Load root directory on mount
  useEffect(() => {
    browseDirectory();
  }, [browseDirectory]);

  const handleClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      browseDirectory(entry.path);
    } else {
      loadVideo(entry.path);
    }
  };

  const goUp = () => {
    if (listing?.parent) {
      browseDirectory(listing.parent);
    }
  };

  return (
    <div className="file-browser">
      {/* Header */}
      <div className="fb-header">
        <h3>Files</h3>
      </div>

      {/* Path breadcrumb */}
      <div className="fb-path">
        <span className="text-xs text-muted truncate">{listing?.path || "/media"}</span>
      </div>

      {/* Up button */}
      {listing?.parent && (
        <button className="fb-entry fb-up" onClick={goUp}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>..</span>
        </button>
      )}

      {/* File list */}
      <div className="fb-list">
        {isLoading ? (
          <div className="fb-loading">Loading...</div>
        ) : listing?.entries.length === 0 ? (
          <div className="fb-empty text-sm text-muted">No video files found</div>
        ) : (
          listing?.entries.map((entry) => (
            <button
              key={entry.path}
              className={`fb-entry ${!entry.is_dir ? "fb-file" : ""}`}
              onClick={() => handleClick(entry)}
              disabled={isLoadingVideo && !entry.is_dir}
              title={entry.path}
            >
              <FileIcon entry={entry} />
              <span className="fb-name truncate">{entry.name}</span>
              {!entry.is_dir && entry.size !== null && (
                <span className="fb-size text-xs text-muted">{formatSize(entry.size)}</span>
              )}
            </button>
          ))
        )}
      </div>

      <style>{`
        .file-browser {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .fb-header {
          padding: 12px 16px 8px;
          border-bottom: 1px solid var(--border);
        }
        .fb-header h3 {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
        }
        .fb-path {
          padding: 6px 16px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
        }
        .fb-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .fb-entry {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 16px;
          text-align: left;
          font-size: 13px;
          color: var(--text-primary);
          border-radius: 0;
          transition: background 0.1s;
        }
        .fb-entry:hover:not(:disabled) {
          background: var(--bg-hover);
        }
        .fb-entry:active:not(:disabled) {
          background: var(--bg-active);
        }
        .fb-up {
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .fb-name {
          flex: 1;
          min-width: 0;
        }
        .fb-size {
          flex-shrink: 0;
        }
        .fb-file:hover .fb-name {
          color: var(--accent);
        }
        .fb-loading,
        .fb-empty {
          padding: 24px 16px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
