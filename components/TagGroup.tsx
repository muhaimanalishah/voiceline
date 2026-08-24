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
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useDroppable, useDraggable } from "@dnd-kit/core";
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
import { useTagsQuery } from "@/lib/hooks/queries/useTags";
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

function DraggableNoteRow({
  rec,
  sourceTagId,
  isClassifying,
  isCopied,
  onClassify,
  onEdit,
  onCopy,
  onExport,
  onDelete,
}: {
  rec: RecordingItem;
  sourceTagId: string | null;
  isClassifying: boolean;
  isCopied: boolean;
  onClassify: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `note-${rec.id}`,
    data: {
      note: rec,
      sourceTagId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.rowWrapper} ${isDragging ? styles.rowDragging : ""}`}
    >
      {/* Left gutter drag handle */}
      <button
        type="button"
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to move note"
        title="Drag to move to another tag"
      >
        <GripVertical size={13} />
      </button>

      <Link
        href={`/notes/${encodeURIComponent(rec.id)}`}
        className={styles.row}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <div className={styles.rowMain}>
          <div className={styles.rowTitleRow}>
            <span className={styles.rowTitle}>{rec.title || "Untitled Note"}</span>
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
            onClick={onClassify}
          >
            {isClassifying ? "Classifying..." : "Classify"}
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={<Pencil size={12} />}
            onClick={onEdit}
          >
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={isCopied ? <Check size={12} /> : <Copy size={12} />}
            onClick={onCopy}
          >
            {isCopied ? "Copied" : "Copy"}
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={<Download size={12} />}
            onClick={onExport}
          >
            Export
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={<Trash2 size={12} />}
            variant="danger"
            onClick={onDelete}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </div>
  );
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

  const { data: tagsData } = useTagsQuery();
  const availableTags = tagsData?.tags || [];

  const updateMutation = useUpdateRecordingMutation();
  const deleteMutation = useDeleteRecordingMutation();
  const classifyMutation = useClassifyRecordingMutation();

  // Droppable container setup for TagGroup
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `tag-${tagId ?? "unclassified"}`,
    data: {
      tagId,
      tagName: name,
    },
  });

  // Dialog states
  const [editNoteTarget, setEditNoteTarget] = useState<RecordingItem | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteTagId, setEditNoteTagId] = useState<string | null>(null);

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

  // Open Edit Note Modal
  const handleOpenEditModal = (rec: RecordingItem) => {
    setEditNoteTarget(rec);
    setEditNoteTitle(rec.title || "");
    setEditNoteTagId(tagId);
  };

  // Edit Note Submit
  const handleEditNoteSubmit = async () => {
    if (!editNoteTarget || !editNoteTitle.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: editNoteTarget.id,
        title: editNoteTitle.trim(),
        tagId: editNoteTagId,
      });
      setEditNoteTarget(null);
      toast.success("Note updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update note.";
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

  const selectedEditTag = availableTags.find((t) => t.id === editNoteTagId);

  const query = searchQuery.trim().toLowerCase();
  const displayedRecordings = query
    ? recordings.filter(
        (rec) =>
          (rec.title && rec.title.toLowerCase().includes(query)) ||
          (rec.textPreview && rec.textPreview.toLowerCase().includes(query))
      )
    : recordings;

  return (
    <div
      ref={setDroppableRef}
      className={`${styles.group} ${isUnclassified ? styles.groupUnclassified : ""} ${
        isOver ? styles.groupDropTarget : ""
      }`}
    >
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
                <DraggableNoteRow
                  key={rec.id}
                  rec={rec}
                  sourceTagId={tagId}
                  isClassifying={isClassifying}
                  isCopied={isCopied}
                  onClassify={() => handleClassifyNoteClick(rec)}
                  onEdit={() => handleOpenEditModal(rec)}
                  onCopy={() => handleCopyNote(rec)}
                  onExport={() => handleExportNote(rec)}
                  onDelete={() => setDeleteNoteTarget(rec)}
                />
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

      {/* Edit Note Modal (Name + Tag Dropdown) */}
      {editNoteTarget && (
        <Modal title="Edit Note" onClose={() => setEditNoteTarget(null)}>
          <FormField label="Title">
            <Input
              value={editNoteTitle}
              onChange={(e) => setEditNoteTitle(e.target.value)}
              placeholder="Note title..."
              autoFocus
            />
          </FormField>

          <FormField label="Tag">
            <DropdownMenu
              align="left"
              trigger={
                <button type="button" className={styles.tagSelectTrigger}>
                  <div className={styles.tagSelectTriggerLeft}>
                    <TagDot
                      color={selectedEditTag?.color || DEFAULT_TAG_COLOR}
                      size="sm"
                    />
                    <span>{selectedEditTag ? selectedEditTag.name : "Unclassified"}</span>
                  </div>
                  <ChevronDown size={13} color="var(--muted)" />
                </button>
              }
            >
              <DropdownMenuItem
                icon={<TagDot color={DEFAULT_TAG_COLOR} size="sm" />}
                onClick={() => setEditNoteTagId(null)}
              >
                Unclassified {editNoteTagId === null ? "✓" : ""}
              </DropdownMenuItem>
              {availableTags.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  icon={<TagDot color={t.color || DEFAULT_TAG_COLOR} size="sm" />}
                  onClick={() => setEditNoteTagId(t.id)}
                >
                  {t.name} {t.id === editNoteTagId ? "✓" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenu>
          </FormField>

          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setEditNoteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEditNoteSubmit}
              isLoading={updateMutation.isPending}
              disabled={!editNoteTitle.trim()}
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
