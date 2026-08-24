"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sparkles,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RecordingItem } from "@/lib/recordings/types";
import { DEFAULT_TAG_COLOR } from "@/lib/recordings/constants";
import { exportNoteAsMarkdown } from "@/lib/utils/export";
import { formatRelativeDate } from "@/lib/utils/format";
import styles from "./TagGroup.module.css";

const PAGE_SIZE = 10;

interface TagGroupProps {
  tagId: string | null;
  name: string;
  description: string;
  color?: string | null;
  totalCount: number;
  defaultOpen?: boolean;
  canDelete?: boolean;
  refreshTrigger?: number;
  searchQuery?: string;
  onNoteChanged?: () => void;
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
  refreshTrigger,
  searchQuery = "",
  onNoteChanged,
  onRename,
  onDelete,
}: TagGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Group header menu
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);

  // Row item 3-dots menu state
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);

  // Row Action Dialogs
  const [renameNoteTarget, setRenameNoteTarget] = useState<RecordingItem | null>(null);
  const [renameNoteTitle, setRenameNoteTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteNoteTarget, setDeleteNoteTarget] = useState<RecordingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [classifyWarningTarget, setClassifyWarningTarget] = useState<RecordingItem | null>(null);
  const [isClassifyingId, setIsClassifyingId] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isUnclassified = tagId === null;

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean = false) => {
      setIsLoading(true);
      try {
        const tagParam = isUnclassified ? "unclassified" : tagId;
        const res = await fetch(
          `/api/recordings?tagId=${encodeURIComponent(tagParam as string)}&page=${nextPage}&limit=${PAGE_SIZE}`
        );
        const data = await res.json();
        if (res.ok && data.recordings) {
          setRecordings((prev) =>
            reset || nextPage === 1 ? data.recordings : [...prev, ...data.recordings]
          );
          setHasMore(Boolean(data.hasMore));
          setPage(data.page || nextPage);
        }
      } catch (err) {
        console.error("Failed to load recordings for group:", err);
      } finally {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    },
    [isUnclassified, tagId]
  );

  const handleToggle = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && !hasLoadedOnce) {
      loadPage(1, true);
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadPage(page + 1);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPage(1, true);
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!groupMenuOpen && !activeMenuNoteId) return;
    const close = () => {
      setGroupMenuOpen(false);
      setActiveMenuNoteId(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [groupMenuOpen, activeMenuNoteId]);

  // Row Action Handlers
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

  const handleRenameNoteSubmit = async () => {
    if (!renameNoteTarget || !renameNoteTitle.trim()) return;
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(renameNoteTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameNoteTitle.trim() }),
      });
      if (res.ok) {
        setRenameNoteTarget(null);
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === renameNoteTarget.id ? { ...r, title: renameNoteTitle.trim() } : r
          )
        );
        toast.success("Note renamed.");
        onNoteChanged?.();
      } else {
        toast.error("Failed to rename note.");
      }
    } catch (err) {
      console.error("Failed to rename note:", err);
      toast.error("Failed to rename note.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteNoteSubmit = async () => {
    if (!deleteNoteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(deleteNoteTarget.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteNoteTarget(null);
        setRecordings((prev) => prev.filter((r) => r.id !== deleteNoteTarget.id));
        toast.success("Note deleted.");
        onNoteChanged?.();
      } else {
        toast.error("Failed to delete note.");
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
      toast.error("Failed to delete note.");
    } finally {
      setIsDeleting(false);
    }
  };

  const runRowClassification = async (rec: RecordingItem) => {
    setIsClassifyingId(rec.id);
    setClassifyWarningTarget(null);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(rec.id)}/classify`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.title) {
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === rec.id ? { ...r, title: data.title, isClassified: true } : r
          )
        );
        toast.success("Note classified.");
        onNoteChanged?.();
      } else {
        toast.error(data.error || "Failed to classify note.");
      }
    } catch (err) {
      console.error("Failed to classify note:", err);
      toast.error("Failed to classify note.");
    } finally {
      setIsClassifyingId(null);
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
          <span
            className={styles.dot}
            style={{
              background: isUnclassified
                ? DEFAULT_TAG_COLOR
                : color || DEFAULT_TAG_COLOR,
            }}
          />
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
          <span className={styles.countBadge}>
            {totalCount} {totalCount === 1 ? "note" : "notes"}
          </span>
          {!isUnclassified && (
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setGroupMenuOpen((v) => !v);
                }}
                aria-label="Tag actions"
              >
                <MoreHorizontal size={14} />
              </button>
              {groupMenuOpen && (
                <div className={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setGroupMenuOpen(false);
                      onRename?.();
                    }}
                  >
                    <Pencil size={12} />
                    Rename
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className={`${styles.menuItem} ${styles.menuItemDanger}`}
                      onClick={() => {
                        setGroupMenuOpen(false);
                        onDelete?.();
                      }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="This tag is protected and cannot be deleted"
                      className={`${styles.menuItem} ${styles.menuItemDisabled}`}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className={styles.rows}>
          {displayedRecordings.length === 0 && hasLoadedOnce && !isLoading ? (
            <div className={styles.emptyRow}>
              {query ? "No matching notes found" : "No notes yet in this tag"}
            </div>
          ) : (
            displayedRecordings.map((rec) => {
              const isMenuOpen = activeMenuNoteId === rec.id;
              const isClassifying = isClassifyingId === rec.id;
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
                    <button
                      type="button"
                      className={styles.rowMenuBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuNoteId(isMenuOpen ? null : rec.id);
                      }}
                      aria-label="Note actions"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {isMenuOpen && (
                      <div className={styles.rowDropdown} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            handleClassifyNoteClick(rec);
                          }}
                          disabled={isClassifying}
                        >
                          {isClassifying ? (
                            <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          <span>{isClassifying ? "Classifying..." : "Classify"}</span>
                        </button>

                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            setRenameNoteTitle(rec.title || "");
                            setRenameNoteTarget(rec);
                          }}
                        >
                          <Pencil size={12} />
                          <span>Rename</span>
                        </button>

                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            handleCopyNote(rec);
                          }}
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          <span>{isCopied ? "Copied" : "Copy"}</span>
                        </button>

                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            handleExportNote(rec);
                          }}
                        >
                          <Download size={12} />
                          <span>Export</span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.menuItem} ${styles.menuItemDanger}`}
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            setDeleteNoteTarget(rec);
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && recordings.length === 0 && (
            <div className={styles.emptyRow}>
              <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            </div>
          )}

          {hasMore && !query && (
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <ChevronDown size={12} />
              )}
              Load more
            </button>
          )}
        </div>
      )}

      {/* Rename Note Modal */}
      {renameNoteTarget && (
        <Modal title="Rename Note" onClose={() => setRenameNoteTarget(null)}>
          <div className={styles.field}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={styles.input}
              value={renameNoteTitle}
              onChange={(e) => setRenameNoteTitle(e.target.value)}
              placeholder="Note title..."
              autoFocus
            />
          </div>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setRenameNoteTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.primaryBtn}`}
              onClick={handleRenameNoteSubmit}
              disabled={isRenaming || !renameNoteTitle.trim()}
            >
              {isRenaming ? "Saving..." : "Save"}
            </button>
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
          isLoading={isDeleting}
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
