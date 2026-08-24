"use client";

import React, { useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { RecordingItem } from "@/lib/recordings/types";
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

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
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

  const loadPage = React.useCallback(async (nextPage: number, reset: boolean = false) => {
    setIsLoading(true);
    try {
      const tagParam = isUnclassified ? "unclassified" : tagId;
      const res = await fetch(
        `/api/recordings?tagId=${encodeURIComponent(tagParam as string)}&page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const data = await res.json();
      if (res.ok && data.recordings) {
        setRecordings((prev) => (reset || nextPage === 1 ? data.recordings : [...prev, ...data.recordings]));
        setHasMore(Boolean(data.hasMore));
        setPage(data.page || nextPage);
      }
    } catch (err) {
      console.error("Failed to load recordings for group:", err);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [isUnclassified, tagId]);

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

  React.useEffect(() => {
    if (isOpen) {
      loadPage(1, true);
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
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
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  const handleExportNote = async (rec: RecordingItem) => {
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(rec.id)}`);
      const data = await res.json();
      const recording = data.recording;
      if (!recording) return;

      const title = recording.title || rec.title || "transcript";
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const dateStr = new Date(recording.createdAt).toISOString().split("T")[0];
      const filename = `${sanitizedTitle}-${dateStr}.md`;

      const markdownContent = [
        `# ${title}`,
        "",
        `- **Date:** ${new Date(recording.createdAt).toLocaleString()}`,
        `- **Model:** ${recording.model}`,
        "",
        "---",
        "",
        recording.text,
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
    } catch (err) {
      console.error("Failed to export markdown:", err);
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
          prev.map((r) => (r.id === renameNoteTarget.id ? { ...r, title: renameNoteTitle.trim() } : r))
        );
        onNoteChanged?.();
      }
    } catch (err) {
      console.error("Failed to rename note:", err);
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
        onNoteChanged?.();
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
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
          prev.map((r) => (r.id === rec.id ? { ...r, title: data.title, isClassified: true } : r))
        );
        onNoteChanged?.();
      }
    } catch (err) {
      console.error("Failed to classify note:", err);
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
            style={{ background: isUnclassified ? "#71717a" : color || "#71717a" }}
          />
          <span className={`${styles.groupName} ${isUnclassified ? styles.groupNameUnclassified : ""}`}>
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
                    <span className={styles.rowDate}>{formatDate(rec.createdAt)}</span>
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

      {/* Inline Rename Note Modal */}
      {renameNoteTarget && (
        <div className={styles.modalBackdrop} onClick={() => setRenameNoteTarget(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Rename Note</h3>
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
          </div>
        </div>
      )}

      {/* Delete Note Confirmation Modal */}
      {deleteNoteTarget && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteNoteTarget(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Note</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{deleteNoteTarget.title || deleteNoteTarget.id}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setDeleteNoteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.dangerBtn}`}
                onClick={handleDeleteNoteSubmit}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Already-Classified Warning Confirmation Modal */}
      {classifyWarningTarget && (
        <div className={styles.modalBackdrop} onClick={() => setClassifyWarningTarget(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.warnHeader}>
              <AlertTriangle size={18} className={styles.warnIcon} />
              <h3 className={styles.modalTitle}>Already Classified</h3>
            </div>
            <p className={styles.modalText}>
              This note has already been classified. Classifying again will re-evaluate tags and update the title.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setClassifyWarningTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
                onClick={() => runRowClassification(classifyWarningTarget)}
              >
                Classify Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
