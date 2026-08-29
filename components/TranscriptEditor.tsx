"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  FileText,
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
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useTagsQuery } from "@/hooks/queries/useTags";
import {
  useUpdateRecordingMutation,
  useProcessRecordingMutation,
} from "@/hooks/queries/useRecordings";
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
  const [cleanText, setCleanText] = useState(recording.text || "");
  const [rawTranscript] = useState(recording.rawTranscript || recording.text || "");
  const [isProcessed, setIsProcessed] = useState(Boolean(recording.text));
  const [viewMode, setViewMode] = useState<"clean" | "raw">(
    recording.text ? "clean" : "raw"
  );

  const [currentTagId, setCurrentTagId] = useState<string | null>(
    recording.tagId ?? null
  );
  const [summary, setSummary] = useState<string[] | null>(
    recording.summary ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProcessWarning, setShowProcessWarning] = useState(false);

  const { data: tagsData } = useTagsQuery();
  const tags = tagsData?.tags || [];
  const activeTag = tags.find((t) => t.id === currentTagId);

  const updateMutation = useUpdateRecordingMutation();
  const processMutation = useProcessRecordingMutation();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeDisplayText = viewMode === "clean" ? cleanText : rawTranscript;

  const saveChanges = useCallback(
    async (textToSave: string = cleanText, titleToSave: string = title) => {
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
    [recording.id, cleanText, title, onUpdate]
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (viewMode === "clean") {
      setCleanText(newText);
      const unsaved =
        newText !== (recording.text || "") ||
        title !== (recording.title || recording.id);
      setHasUnsavedChanges(unsaved);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveChanges(newText, title);
      }, 2000);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const unsaved =
      cleanText !== (recording.text || "") ||
      newTitle !== (recording.title || recording.id);
    setHasUnsavedChanges(unsaved);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges(cleanText, newTitle);
    }, 2000);
  };

  const handleTitleBlur = () => {
    if (hasUnsavedChanges) {
      saveChanges(cleanText, title);
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

  const runProcess = async () => {
    setShowProcessWarning(false);
    try {
      const data = await processMutation.mutateAsync(recording.id);
      if (data?.text) {
        setCleanText(data.text);
        setIsProcessed(true);
        setViewMode("clean");
      }
      if (data?.title) {
        setTitle(data.title);
      }
      if (data?.tagId !== undefined) {
        setCurrentTagId(data.tagId);
      }
      if (Array.isArray(data?.summary)) {
        setSummary(data.summary);
      }
      setHasUnsavedChanges(false);
      await onUpdate(recording.id, data.text || cleanText, data.title || title);
      toast.success("Voice note processed into clean text");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed.";
      console.error("Processing error:", err);
      toast.error(msg);
    }
  };

  const handleProcessClick = () => {
    if (isProcessed) {
      setShowProcessWarning(true);
    } else {
      runProcess();
    }
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeDisplayText);
      setCopied(true);
      toast.success(`Copied ${viewMode === "clean" ? "clean" : "raw"} text to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard.");
    }
  }, [activeDisplayText, viewMode]);

  const handleDownloadMarkdown = () => {
    exportNoteAsMarkdown({
      title,
      text: activeDisplayText,
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
      saveChanges(cleanText, title);
      toast.success("Saved");
    },
    { allowInInputs: true }
  );

  useKeyboardShortcut("alt+c", () => {
    handleCopy();
  });

  const wordCount = activeDisplayText.trim()
    ? activeDisplayText.trim().split(/\s+/).length
    : 0;
  const charCount = activeDisplayText.length;
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

              {/* Raw vs Clean View Mode Pill Toggle */}
              {isProcessed && (
                <>
                  <span className={styles.metaDot}>•</span>
                  <div className={styles.viewModeToggle}>
                    <button
                      type="button"
                      className={`${styles.viewModeBtn} ${
                        viewMode === "clean" ? styles.viewModeBtnActive : ""
                      }`}
                      onClick={() => setViewMode("clean")}
                    >
                      Clean
                    </button>
                    <button
                      type="button"
                      className={`${styles.viewModeBtn} ${
                        viewMode === "raw" ? styles.viewModeBtnActive : ""
                      }`}
                      onClick={() => setViewMode("raw")}
                    >
                      Raw
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={styles.headerRightArea}>
            <div className={styles.headerTopStats}>
              <div className={styles.statsGroup}>
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} chars</span>
                {viewMode === "raw" && <span>• (Raw)</span>}
              </div>

              <div className={styles.saveStatus}>
                {isSaving ? (
                  <span className={styles.statusSaving}>
                    <Spinner size="xs" /> Saving
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className={styles.statusUnsaved}>● Unsaved</span>
                ) : (
                  <span className={styles.statusSaved}>
                    <CheckCircle2
                      size={11}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    Saved
                  </span>
                )}
              </div>
            </div>

            <div className={styles.toolbarActions}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleProcessClick}
                isLoading={processMutation.isPending}
                icon={<Sparkles size={13} />}
                title="Process Note (Clean speech, title & organize)"
              >
                {isProcessed ? "Re-process" : "Process Note"}
              </Button>
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
        </div>

        {/* Expansive Main Editor Area */}
        <div className={styles.editorArea}>
          {/* Raw Mode Banner Indicator */}
          {viewMode === "raw" && isProcessed && (
            <div className={styles.rawBanner}>
              <FileText size={13} />
              <span>Viewing original raw audio transcript (read-only). Switch to <strong>Clean</strong> to edit.</span>
            </div>
          )}

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
            value={activeDisplayText}
            onChange={handleTextChange}
            readOnly={viewMode === "raw" && isProcessed}
            placeholder={
              viewMode === "raw"
                ? "Original audio transcript..."
                : "Cleaned note text..."
            }
          />
        </div>
      </div>

      {/* Re-process Confirmation Warning Modal */}
      {showProcessWarning && (
        <ConfirmDialog
          title="Re-process Note?"
          description="This note has already been cleaned and processed. Re-processing will re-evaluate the raw transcript and refresh the clean text."
          confirmText="Re-process"
          variant="warning"
          isLoading={processMutation.isPending}
          onConfirm={runProcess}
          onCancel={() => setShowProcessWarning(false)}
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

