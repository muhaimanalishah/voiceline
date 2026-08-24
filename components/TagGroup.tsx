"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sparkles,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Modal,
  ConfirmDialog,
  Button,
  Badge,
  TagDot,
  FormField,
  Input,
  Spinner,
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui";
import { RecordingItem } from "@/lib/recordings/types";
import { DEFAULT_TAG_COLOR } from "@/lib/recordings/constants";
import { exportNoteAsMarkdown } from "@/lib/utils/export";
import { formatRelativeDate } from "@/lib/utils/format";
import {
  useRecordingsByTagInfiniteQuery,
  useUpdateRecordingMutation,
  useDeleteRecordingMutation,
  useClassifyRecordingMutation,
} from "@/lib/hooks/queries/useRecordings";
import styles from "./TagGroup.module.css";

interface TagGroupProps {
  tagId: string | null;
  name: string;
  description: string;
  color?: string | null;
  totalCount: number;
  defaultOpen?: boolean;
  canDelete?: boolean;
  searchQuery?: string;
  onRename?: () => void;
  onDelete?: () => void;
}

export default function TagGroup({
  tagId,
  name,
  description,
  color,
  totalCount,
  defaultOpen = false,
  canDelete = true,
  searchQuery = "",
  onRename,
  onDelete,
}: TagGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useRecordingsByTagInfiniteQuery(tagId, isOpen);

  const recordings = data?.pages.flatMap((page) => page.recordings) || [];

  const updateMutation = useUpdateRecordingMutation();
  const deleteMutation = useDeleteRecordingMutation();
  const classifyMutation = useClassifyRecordingMutation();

  // Dialog states
  const [renameNoteTarget, setRenameNoteTarget] = useState<RecordingItem | null>(null);
  const [renameNoteTitle, setRenameNoteTitle] = useState("");
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<RecordingItem | null>(null);
  const [classifyWarningTarget, setClassifyWarningTarget] = useState<RecordingItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isUnclassified = tagId === null;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  // Copy Note handler
  const handleCopyNote = async (rec: RecordingItem) => {
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(rec.id)}`);
      const data = await res.json();
      const text = data.recording?.text || rec.textPreview;
      await navigator.clipboard.writeText(text);
      setCopiedId(rec.id);
      toast.success("Copied note to clipboard");
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
      toast.error("Failed to copy note.");
    }
  };

  // Export Note handler
  const handleExportNote = async (rec: RecordingItem) => {
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(rec.id)}`);
      const data = await res.json();
      const recording = data.recording;
      if (!recording) return;

      exportNoteAsMarkdown({
        title: recording.title || rec.title,
        text: recording.text,
        createdAt: recording.createdAt,
        model: recording.model,
      });
      toast.success("Downloaded markdown");
    } catch (err) {
      console.error("Failed to export markdown:", err);
      toast.error("Failed to export markdown.");
    }
  };

  // Rename Note Submit
  const handleRenameNoteSubmit = async () => {
    if (!renameNoteTarget || !renameNoteTitle.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: renameNoteTarget.id,
        title: renameNoteTitle.trim(),
      });
      setRenameNoteTarget(null);
      toast.success("Note renamed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to rename note.";
      toast.error(msg);
    }
  };

  // Delete Note Submit
  const handleDeleteNoteSubmit = async () => {
    if (!deleteNoteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteNoteTarget.id);
      setDeleteNoteTarget(null);
      toast.success("Note deleted.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete note.";
      toast.error(msg);
    }
  };

  // Classify Note Submit
  const runRowClassification = async (rec: RecordingItem) => {
    setClassifyWarningTarget(null);
    try {
      await classifyMutation.mutateAsync(rec.id);
      toast.success("Note classified.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to classify note.";
      toast.error(msg);
    }
  };

  const handleClassifyNoteClick = (rec: RecordingItem) => {
    if (rec.isClassified) {
      setClassifyWarningTarget(rec);
    } else {
      runRowClassification(rec);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const displayedRecordings = query
    ? recordings.filter(
        (rec) =>
          (rec.title && rec.title.toLowerCase().includes(query)) ||
          (rec.textPreview && rec.textPreview.toLowerCase().includes(query))
      )
    : recordings;

  return (
    <div className={`${styles.group} ${isUnclassified ? styles.groupUnclassified : ""}`}>
      <div className={styles.groupHeader}>
        <button type="button" className={styles.headerLeft} onClick={handleToggle}>
          <ChevronDown
            size={14}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
          <TagDot color={isUnclassified ? DEFAULT_TAG_COLOR : color} size="sm" />
          <span
            className={`${styles.groupName} ${
              isUnclassified ? styles.groupNameUnclassified : ""
            }`}
          >
            {name}
          </span>
          {description && <span className={styles.groupDescription}>{description}</span>}
        </button>

        <div className={styles.headerRight}>
          <Badge variant="muted">
            {totalCount} {totalCount === 1 ? "note" : "notes"}
          </Badge>

          {!isUnclassified && (
            <DropdownMenu
              trigger={
                <button type="button" className={styles.menuBtn} aria-label="Tag actions">
                  <MoreHorizontal size={14} />
                </button>
              }
            >
              <DropdownMenuItem icon={<Pencil size={12} />} onClick={onRename}>
                Rename
              </DropdownMenuItem>
              {canDelete ? (
                <DropdownMenuItem
                  icon={<Trash2 size={12} />}
                  variant="danger"
                  onClick={onDelete}
                >
                  Delete
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<Trash2 size={12} />}
                  disabled
                  title="This tag is protected and cannot be deleted"
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenu>
          )}
        </div>
      </div>

      {isOpen && (
        <div className={styles.rows}>
          {displayedRecordings.length === 0 && !isLoading ? (
            <div className={styles.emptyRow}>
              {query ? "No matching notes found" : "No notes yet in this tag"}
            </div>
          ) : (
            displayedRecordings.map((rec) => {
              const isClassifying =
                classifyMutation.isPending &&
                classifyMutation.variables === rec.id;
              const isCopied = copiedId === rec.id;

              return (
                <div key={rec.id} className={styles.rowWrapper}>
                  <Link
                    href={`/notes/${encodeURIComponent(rec.id)}`}
                    className={styles.row}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitleRow}>
                        <span className={styles.rowTitle}>{rec.title || "Untitled Note"}</span>
                        {rec.isClassified && (
                          <span className={styles.rowClassifiedDot} title="Classified" />
                        )}
                      </div>
                      <div className={styles.rowPreview}>{rec.textPreview || "Empty note"}</div>
                    </div>
                    <span className={styles.rowDate}>{formatRelativeDate(rec.createdAt)}</span>
                  </Link>

                  {/* 3-Dots Action Menu on each note row */}
                  <div className={styles.rowActionsWrap}>
                    <DropdownMenu
                      trigger={
                        <button
                          type="button"
                          className={styles.rowMenuBtn}
                          aria-label="Note actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      }
                    >
                      <DropdownMenuItem
                        icon={
                          isClassifying ? (
                            <Spinner size="xs" />
                          ) : (
                            <Sparkles size={12} />
                          )
                        }
                        disabled={isClassifying}
                        onClick={() => handleClassifyNoteClick(rec)}
                      >
                        {isClassifying ? "Classifying..." : "Classify"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        icon={<Pencil size={12} />}
                        onClick={() => {
                          setRenameNoteTitle(rec.title || "");
                          setRenameNoteTarget(rec);
                        }}
                      >
                        Rename
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        icon={isCopied ? <Check size={12} /> : <Copy size={12} />}
                        onClick={() => handleCopyNote(rec)}
                      >
                        {isCopied ? "Copied" : "Copy"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        icon={<Download size={12} />}
                        onClick={() => handleExportNote(rec)}
                      >
                        Export
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        icon={<Trash2 size={12} />}
                        variant="danger"
                        onClick={() => setDeleteNoteTarget(rec)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}

          {isLoading && recordings.length === 0 && (
            <div className={styles.emptyRow}>
              <Spinner size="sm" />
            </div>
          )}

          {hasNextPage && !query && (
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Spinner size="xs" />
              ) : (
                <ChevronDown size={12} />
              )}
              <span>Load more</span>
            </button>
          )}
        </div>
      )}

      {/* Rename Note Modal */}
      {renameNoteTarget && (
        <Modal title="Rename Note" onClose={() => setRenameNoteTarget(null)}>
          <FormField label="Title">
            <Input
              value={renameNoteTitle}
              onChange={(e) => setRenameNoteTitle(e.target.value)}
              placeholder="Note title..."
              autoFocus
            />
          </FormField>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setRenameNoteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRenameNoteSubmit}
              isLoading={updateMutation.isPending}
              disabled={!renameNoteTitle.trim()}
            >
              Save
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete Note Confirmation Modal */}
      {deleteNoteTarget && (
        <ConfirmDialog
          title="Delete Note"
          description={
            <>
              Are you sure you want to delete <strong>{deleteNoteTarget.title || deleteNoteTarget.id}</strong>?
            </>
          }
          confirmText="Delete"
          variant="danger"
          isLoading={deleteMutation.isPending}
          onConfirm={handleDeleteNoteSubmit}
          onCancel={() => setDeleteNoteTarget(null)}
        />
      )}

      {/* Already-Classified Warning Confirmation Modal */}
      {classifyWarningTarget && (
        <ConfirmDialog
          title="Already Classified"
          description="This note has already been classified. Classifying again will re-evaluate tags and update the title."
          confirmText="Classify Anyway"
          variant="warning"
          onConfirm={() => runRowClassification(classifyWarningTarget)}
          onCancel={() => setClassifyWarningTarget(null)}
        />
      )}
    </div>
  );
}
