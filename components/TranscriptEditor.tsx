"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  Trash2,
  Play,
  Volume2,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
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

  // Keyboard shortcut listener
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

      // Space: Toggle play/pause when audio loaded and not typing
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

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  const formattedDate = new Date(recording.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={styles.workspace}>
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      {/* Top Header Bar */}
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <input
            type="text"
            className={styles.titleInput}
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="Untitled Note..."
            aria-label="Note title"
          />
          <div className={styles.metaSubtitle}>
            <span>🕒 {formattedDate}</span>
            <span>•</span>
            <span className={styles.modelTag}>{recording.model}</span>
          </div>
        </div>

        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleCopy}
            title="Copy text (Alt+C)"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleDownloadMarkdown}
            title="Download Markdown"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.dangerBtn}`}
            onClick={() => setShowDeleteModal(true)}
            title="Delete note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Audio Strip with Lazy Loading & Speed Options */}
      <div className={styles.audioStrip}>
        {!isAudioLoaded ? (
          <button
            type="button"
            className={styles.lazyAudioLoadBtn}
            onClick={() => setIsAudioLoaded(true)}
          >
            <Play size={13} fill="currentColor" />
            <span>Load Audio Player</span>
            {recording.size ? (
              <span style={{ color: "#a1a1aa", fontSize: "0.72rem" }}>
                ({(recording.size / 1024).toFixed(0)} KB)
              </span>
            ) : null}
          </button>
        ) : (
          <>
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

            <div className={styles.speedGroup}>
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
          </>
        )}
      </div>

      {/* Expansive Main Editor Area */}
      <div className={styles.editorContainer}>
        <textarea
          className={styles.textarea}
          dir="auto"
          value={text}
          onChange={handleTextChange}
          placeholder="Start typing or listen to your recording transcript..."
        />
      </div>

      {/* Bottom Status & Info Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.statsGroup}>
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>

        <div className={styles.saveStatus}>
          {isSaving ? (
            <span className={styles.statusSaving}>
              <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", display: "inline" }} /> Saving...
            </span>
          ) : hasUnsavedChanges ? (
            <span className={styles.statusUnsaved}>● Unsaved</span>
          ) : (
            <span className={styles.statusSaved}>
              <CheckCircle2 size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Delete Note</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{title || recording.id}</strong>?
              This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.dangerBtn}`}
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
