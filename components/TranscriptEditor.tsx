"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ConfirmDialog,
  Button,
  Spinner,
  TagDot,
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui";
import { RecordingDetail } from "@/lib/recordings/types";
import { DEFAULT_TAG_COLOR } from "@/lib/recordings/constants";
import { exportNoteAsMarkdown } from "@/lib/utils/export";
import { formatFullDate } from "@/lib/utils/format";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { useTagsQuery } from "@/lib/hooks/queries/useTags";
import { useUpdateRecordingMutation } from "@/lib/hooks/queries/useRecordings";
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
  const [currentTagId, setCurrentTagId] = useState<string | null>(
    recording.tagId ?? null
  );
  const [summary, setSummary] = useState<string[] | null>(
    recording.summary ?? null
  );
  const [isClassified, setIsClassified] = useState(Boolean(recording.isClassified));
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClassifyWarning, setShowClassifyWarning] = useState(false);

  const { data: tagsData } = useTagsQuery();
  const tags = tagsData?.tags || [];
  const activeTag = tags.find((t) => t.id === currentTagId);

  const updateMutation = useUpdateRecordingMutation();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveChanges = useCallback(
    async (textToSave: string = text, titleToSave: string = title) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSaving(true);
      try {
        await onUpdate(recording.id, textToSave, titleToSave);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to save changes:", err);
        toast.error("Failed to save changes.");
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

  const handleTagSelect = async (newTagId: string | null, newTagName: string) => {
    if (newTagId === currentTagId) return;
    setCurrentTagId(newTagId);
    try {
      await updateMutation.mutateAsync({
        id: recording.id,
        tagId: newTagId,
      });
      toast.success(`Tag changed to "${newTagName}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to change tag.";
      toast.error(msg);
      setCurrentTagId(recording.tagId ?? null);
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
      const updatedText = data.text || text;
      setTitle(generatedTitle);
      setText(updatedText);
      setIsClassified(true);
      if (data.tagId !== undefined) {
        setCurrentTagId(data.tagId);
      }
      if (Array.isArray(data.summary)) {
        setSummary(data.summary);
      }
      setHasUnsavedChanges(false);
      await onUpdate(recording.id, updatedText, generatedTitle);
      toast.success("Translated, summarized & classified");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Classification failed";
      console.error("Classification error:", err);
      toast.error(msg);
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
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard.");
    }
  }, [text]);

  const handleResetToRaw = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(recording.id)}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      const targetText = data.text || rawTranscript;
      setText(targetText);
      if (data.rawTranscript) setRawTranscript(data.rawTranscript);
      setHasUnsavedChanges(false);
      await onUpdate(recording.id, targetText, title);
      toast.success("Reset to original transcript");
    } catch (err) {
      console.error("Failed to reset transcript:", err);
      setText(rawTranscript);
      setHasUnsavedChanges(false);
      toast.info("Reset to cached original transcript");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownloadMarkdown = () => {
    exportNoteAsMarkdown({
      title,
      text,
      createdAt: recording.createdAt,
      model: recording.model,
      summary,
    });
    toast.success("Downloaded markdown");
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete(recording.id);
      toast.success("Note deleted successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete note.";
      console.error("Delete note error:", err);
      toast.error(msg);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Keyboard shortcuts: Cmd+S / Ctrl+S to save, Alt+C to copy
  useKeyboardShortcut(
    "ctrl+s",
    () => {
      saveChanges(text, title);
      toast.success("Saved");
    },
    { allowInInputs: true }
  );

  useKeyboardShortcut("alt+c", () => {
    handleCopy();
  });

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const hasModifiedRaw = rawTranscript && text.trim() !== rawTranscript.trim();
  const formattedDate = formatFullDate(recording.createdAt);

  return (
    <div className={styles.workspace}>
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

              {/* Interactive Tag Badge Dropdown Selector */}
              <DropdownMenu
                align="left"
                trigger={
                  <button
                    type="button"
                    className={styles.tagSelectorTrigger}
                    title="Click to change tag"
                  >
                    <TagDot
                      color={activeTag?.color || DEFAULT_TAG_COLOR}
                      size="sm"
                    />
                    <span>{activeTag ? activeTag.name : "Unclassified"}</span>
                    <ChevronDown size={11} className={styles.tagSelectorChevron} />
                  </button>
                }
              >
                <DropdownMenuItem
                  icon={<TagDot color={DEFAULT_TAG_COLOR} size="sm" />}
                  onClick={() => handleTagSelect(null, "Unclassified")}
                >
                  Unclassified {currentTagId === null ? "(Current)" : ""}
                </DropdownMenuItem>
                {tags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    icon={
                      <TagDot
                        color={tag.color || DEFAULT_TAG_COLOR}
                        size="sm"
                      />
                    }
                    onClick={() => handleTagSelect(tag.id, tag.name)}
                  >
                    {tag.name} {tag.id === currentTagId ? "(Current)" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenu>
            </div>
          </div>

          <div className={styles.toolbarActions}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClassifyClick}
              isLoading={isClassifying}
              icon={<Sparkles size={13} />}
              title="Classify Note (Generate AI Title)"
            >
              Classify
            </Button>
            {hasModifiedRaw ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToRaw}
                isLoading={isResetting}
                icon={<RotateCcw size={13} />}
                title="Reset to original OpenAI transcript"
              >
                Reset
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check size={13} /> : <Copy size={13} />}
              title="Copy text (Alt+C)"
            >
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              icon={<Download size={13} />}
              title="Export Markdown"
            >
              Export
            </Button>
            <Button
              variant="iconDanger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              title="Delete note"
              icon={<Trash2 size={13} />}
            />
          </div>
        </div>

        {/* Expansive Main Editor Area */}
        <div className={styles.editorArea}>
          {/* Key Takeaways Summary Card */}
          {summary && summary.length > 0 && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <Sparkles size={13} className={styles.summaryIcon} />
                <span>Key Takeaways</span>
              </div>
              <ul className={styles.summaryList}>
                {summary.map((point, idx) => (
                  <li key={idx} className={styles.summaryItem}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              <Spinner size="xs" /> Saving
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
        <ConfirmDialog
          title="Already Classified"
          description="This note has already been classified. Classifying again will re-evaluate tags and generate a new AI title."
          confirmText="Classify Anyway"
          variant="warning"
          onConfirm={runClassification}
          onCancel={() => setShowClassifyWarning(false)}
        />
      )}

      {/* Delete Note Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmDialog
          title="Delete Note"
          description={
            <>
              Are you sure you want to delete <strong>{title || recording.id}</strong>? This will permanently remove the note.
            </>
          }
          confirmText="Delete"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
