"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RecordingDetail } from "@/lib/recordings/types";
import styles from "./TranscriptEditor.module.css";

interface TranscriptEditorProps {
  recording: RecordingDetail;
  onUpdate: (id: string, newText: string, newTitle?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

export default function TranscriptEditor({
  recording,
  onUpdate,
  onDelete,
}: TranscriptEditorProps) {
  const [title, setTitle] = useState(recording.title || recording.id);
  const [text, setText] = useState(recording.text);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Sync state and reset lazy audio state when recording prop changes
  useEffect(() => {
    setTitle(recording.title || recording.id);
    setText(recording.text);
    setIsAudioLoaded(false);
    setPlaybackSpeed(1);
    setHasUnsavedChanges(false);
    setShowDeleteModal(false);
  }, [recording.id, recording.title, recording.text]);

  const saveChanges = useCallback(
    async (textToSave: string = text, titleToSave: string = title) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSaving(true);
      try {
        await onUpdate(recording.id, textToSave, titleToSave);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to save changes:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [recording.id, text, title, onUpdate]
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    const unsaved =
      newText !== recording.text || title !== (recording.title || recording.id);
    setHasUnsavedChanges(unsaved);

    // Auto-save debounce (2 seconds)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges(newText, title);
    }, 2000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const unsaved =
      text !== recording.text || newTitle !== (recording.title || recording.id);
    setHasUnsavedChanges(unsaved);

    // Auto-save debounce (2 seconds)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges(text, newTitle);
    }, 2000);
  };

  const handleTitleBlur = () => {
    if (hasUnsavedChanges) {
      saveChanges(text, title);
    }
  };

  const handleReset = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setTitle(recording.title || recording.id);
    setText(recording.text);
    setHasUnsavedChanges(false);
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Keyboard shortcut listener for Ctrl+S / Cmd+S, Alt+C, and Space play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      // Ctrl+S / Cmd+S: Save changes
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveChanges(text, title);
        showToast("Changes saved (Ctrl+S)");
        return;
      }

      // Alt+C: Copy transcript
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Space: Toggle play/pause when audio loaded and not typing in text area
      if (e.code === "Space" && !isTyping && isAudioLoaded && audioRef.current) {
        e.preventDefault();
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveChanges, handleCopy, isAudioLoaded, text, title]);

  const handleDownloadMarkdown = () => {
    const formattedDate = new Date(recording.createdAt).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "medium",
    });

    const markdownContent = [
      `# ${title || recording.id}`,
      ``,
      `- **Date:** ${formattedDate}`,
      `- **Model:** ${recording.model}`,
      `- **Audio File:** \`${recording.audioFile}\``,
      ``,
      `---`,
      ``,
      `## Transcript`,
      ``,
      text || "*(No transcript content)*",
      ``,
    ].join("\n");

    const blob = new Blob([markdownContent], {
      type: "text/markdown;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || recording.id).toLowerCase().replace(/[^a-z0-9_-]/g, "-")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete(recording.id);
    } catch (err) {
      console.error("Failed to delete recording:", err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formattedDate = new Date(recording.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={styles.container}>
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      {/* Top Header */}
      <div className={styles.topBar}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              placeholder="Note title..."
              aria-label="Note title"
            />
            <span className={styles.modelBadge}>{recording.model}</span>
          </div>
          <div className={styles.dateSubtitle}>
            <span>🕒 {formattedDate}</span>
            <span>•</span>
            <span>ID: <code>{recording.id}</code></span>
            <span>•</span>
            <span>File: <code>{recording.audioFile}</code></span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className={styles.actionsToolbar}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleCopy}
            title="Copy plain text (Alt+C)"
          >
            {copied ? "✓ Copied!" : "📋 Copy Text"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={handleDownloadMarkdown}
            title="Download as Markdown file"
          >
            📥 Download .md
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => setShowDeleteModal(true)}
            title="Delete this recording"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Audio Player Section with Lazy Loading & Speed Controls */}
      <div className={styles.audioSection}>
        <div className={styles.audioHeader}>
          <span>Audio Playback</span>
          {recording.size && (
            <span>{(recording.size / 1024).toFixed(1)} KB</span>
          )}
        </div>

        {!isAudioLoaded ? (
          <div className={styles.lazyAudioWrapper}>
            <button
              type="button"
              className={styles.lazyAudioBtn}
              onClick={() => setIsAudioLoaded(true)}
            >
              <span>▶</span>
              <span>Load Audio Player</span>
            </button>
            <span className={styles.lazyMetaBadge}>
              Bandwidth saver: audio stream unmounted
            </span>
          </div>
        ) : (
          <div className={styles.audioControlsRow}>
            <audio
              ref={audioRef}
              className={styles.audioPlayer}
              controls
              autoPlay
              src={recording.audioUrl}
              preload="metadata"
              onPlay={() => {
                if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
              }}
            >
              Your browser does not support the audio element.
            </audio>

            <div className={styles.playbackBar}>
              <div className={styles.speedGroup}>
                <span className={styles.speedLabel}>Speed:</span>
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={`${styles.speedBtn} ${
                      playbackSpeed === speed ? styles.speedBtnActive : ""
                    }`}
                    onClick={() => handleSpeedChange(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <span className={styles.speedLabel}>[Space] Play/Pause</span>
            </div>
          </div>
        )}
      </div>

      {/* Transcript Editor Section */}
      <div className={styles.editorSection}>
        <div className={styles.editorHeader}>
          <div className={styles.editorTitle}>
            <span>Transcript Editor</span>
            {isSaving ? (
              <span className={`${styles.statusIndicator} ${styles.saving}`}>
                ● Saving...
              </span>
            ) : hasUnsavedChanges ? (
              <span className={`${styles.statusIndicator} ${styles.unsaved}`}>
                ● Unsaved edits
              </span>
            ) : (
              <span className={`${styles.statusIndicator} ${styles.saved}`}>
                ✓ All changes saved
              </span>
            )}
          </div>
        </div>

        <textarea
          className={styles.textarea}
          dir="auto"
          value={text}
          onChange={handleTextChange}
          placeholder="Transcription text..."
          rows={8}
        />

        <div className={styles.editorFooter}>
          <div className={styles.saveControls}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => saveChanges(text, title)}
              disabled={isSaving || !hasUnsavedChanges}
              title="Save changes (Ctrl+S)"
            >
              {isSaving ? "Saving..." : "Save Changes (Ctrl+S)"}
            </button>
            {hasUnsavedChanges && (
              <button
                type="button"
                className={styles.btn}
                onClick={handleReset}
                disabled={isSaving}
              >
                Discard
              </button>
            )}
          </div>

          <span className={styles.footerNote}>
            💾 Synced with storage (<code>{recording.id}</code>)
          </span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Delete Recording?</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{title || recording.id}</strong>?
              This will permanently remove the audio file and transcript from storage.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
