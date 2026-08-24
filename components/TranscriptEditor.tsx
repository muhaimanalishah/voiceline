"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
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
  const [rawTranscript, setRawTranscript] = useState(
    recording.rawTranscript || recording.text
  );
  const [isClassified, setIsClassified] = useState(Boolean(recording.isClassified));
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClassifyWarning, setShowClassifyWarning] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

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

  const runClassification = async () => {
    setIsClassifying(true);
    setShowClassifyWarning(false);
    try {
      const res = await fetch(
        `/api/recordings/${encodeURIComponent(recording.id)}/classify`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.title) {
        throw new Error(data.error || "Failed to classify note.");
      }

      const generatedTitle = data.title;
      setTitle(generatedTitle);
      setIsClassified(true);
      await onUpdate(recording.id, text, generatedTitle);
      showToast("Classified & title updated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Classification failed";
      console.error("Classification error:", err);
      showToast(msg);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleClassifyClick = () => {
    if (isClassified) {
      setShowClassifyWarning(true);
    } else {
      runClassification();
    }
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  const handleResetToRaw = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(recording.id)}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setText(data.text);
        setRawTranscript(data.rawTranscript || data.text);
        setHasUnsavedChanges(false);
        await onUpdate(recording.id, data.text, title);
        showToast("Reset to original transcript");
      } else {
        // Fallback to local rawTranscript
        setText(rawTranscript);
        setHasUnsavedChanges(false);
        await onUpdate(recording.id, rawTranscript, title);
        showToast("Reset to original transcript");
      }
    } catch (err) {
      console.error("Failed to reset transcript:", err);
      setText(rawTranscript);
      setHasUnsavedChanges(false);
      showToast("Reset locally");
    } finally {
      setIsResetting(false);
    }
  };

  // Keyboard shortcut listener (Ctrl+S, Alt+C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: Save changes
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveChanges(text, title);
        showToast("Saved");
        return;
      }

      // Alt+C: Copy transcript
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveChanges, handleCopy, text, title]);

  const handleDownloadMarkdown = () => {
    const sanitizedTitle = (title || "transcript")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const dateStr = new Date(recording.createdAt).toISOString().split("T")[0];
    const filename = `${sanitizedTitle}-${dateStr}.md`;

    const markdownContent = [
      `# ${title || "Untitled Note"}`,
      "",
      `- **Date:** ${new Date(recording.createdAt).toLocaleString()}`,
      `- **Model:** ${recording.model}`,
      "",
      "---",
      "",
      text,
    ].join("\n");

    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded markdown");
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete(recording.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete note.";
      console.error("Delete note error:", err);
      showToast(msg);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const hasModifiedRaw = rawTranscript && text.trim() !== rawTranscript.trim();

  const formattedDate = new Date(recording.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={styles.workspace}>
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      <div className={styles.docContainer}>
        {/* Top-Left Back to Notes Breadcrumb Navigation */}
        <div className={styles.navBar}>
          <Link href="/" className={styles.backBtn} title="Back to notes list">
            <ArrowLeft size={14} />
            <span>Back to Notes</span>
          </Link>
        </div>

        {/* Top Header Bar */}
        <div className={styles.headerBar}>
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
            <div className={styles.metaRow}>
              <span>{formattedDate}</span>
              <span className={styles.metaDot}>•</span>
              <span className={styles.modelBadge}>{recording.model}</span>
              {isClassified && (
                <>
                  <span className={styles.metaDot}>•</span>
                  <span className={styles.classifiedBadge}>Classified</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleClassifyClick}
              disabled={isClassifying}
              title="Classify Note (Generate AI Title)"
            >
              {isClassifying ? (
                <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <Sparkles size={13} />
              )}
              <span>{isClassifying ? "Classifying..." : "Classify"}</span>
            </button>
            {hasModifiedRaw ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleResetToRaw}
                disabled={isResetting}
                title="Reset to original OpenAI transcript"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            ) : null}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleCopy}
              title="Copy text (Alt+C)"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleDownloadMarkdown}
              title="Export Markdown"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.dangerBtn}`}
              onClick={() => setShowDeleteModal(true)}
              title="Delete note"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Expansive Main Editor Area */}
        <div className={styles.editorArea}>
          <textarea
            className={styles.textarea}
            dir="auto"
            value={text}
            onChange={handleTextChange}
            placeholder="Write note or start speaking..."
          />
        </div>
      </div>

      {/* Subtle Bottom Status Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.statsGroup}>
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>

        <div className={styles.saveStatus}>
          {isSaving ? (
            <span className={styles.statusSaving}>
              <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite", display: "inline" }} /> Saving
            </span>
          ) : hasUnsavedChanges ? (
            <span className={styles.statusUnsaved}>● Unsaved edits</span>
          ) : (
            <span className={styles.statusSaved}>
              <CheckCircle2 size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Already-Classified Warning Confirmation Modal */}
      {showClassifyWarning && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.warnHeader}>
              <AlertTriangle size={18} className={styles.warnIcon} />
              <h3 className={styles.modalTitle}>Already Classified</h3>
            </div>
            <p className={styles.modalText}>
              This note has already been classified. Classifying again will re-evaluate tags and generate a new AI title.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setShowClassifyWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
                onClick={runClassification}
              >
                Classify Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Note Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Delete Note</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{title || recording.id}</strong>?
              This will permanently remove the note.
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
