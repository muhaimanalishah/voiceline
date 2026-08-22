"use client";

import React, { useState, useEffect, useRef } from "react";
import { RecordingDetail } from "@/lib/recordings/types";
import styles from "./TranscriptEditor.module.css";

interface TranscriptEditorProps {
  recording: RecordingDetail;
  onUpdate: (id: string, newText: string, newTitle?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function TranscriptEditor({
  recording,
  onUpdate,
  onDelete,
}: TranscriptEditorProps) {
  const [title, setTitle] = useState(recording.title || recording.id);
  const [text, setText] = useState(recording.text);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state and reset lazy audio state when recording prop changes
  useEffect(() => {
    setTitle(recording.title || recording.id);
    setText(recording.text);
    setIsAudioLoaded(false);
    setHasUnsavedChanges(false);
    setShowDeleteModal(false);
  }, [recording.id, recording.title, recording.text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    const unsaved = newText !== recording.text || title !== (recording.title || recording.id);
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
    const unsaved = text !== recording.text || newTitle !== (recording.title || recording.id);
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

  const saveChanges = async (
    textToSave: string = text,
    titleToSave: string = title
  ) => {
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
  };

  const handleReset = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setTitle(recording.title || recording.id);
    setText(recording.text);
    setHasUnsavedChanges(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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
            title="Copy plain text"
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

      {/* Audio Player Section with Lazy Loading */}
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
          <audio
            className={styles.audioPlayer}
            controls
            autoPlay
            src={recording.audioUrl}
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
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
            >
              {isSaving ? "Saving..." : "Save Changes"}
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
