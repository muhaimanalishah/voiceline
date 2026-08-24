"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  activeNoteId?: string | null;
  onSelectNote?: (recording: RecordingItem) => void;
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
  activeNoteId,
  onSelectNote,
  onRename,
  onDelete,
}: TagGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

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
                  setMenuOpen((v) => !v);
                }}
                aria-label="Tag actions"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuOpen(false);
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
                        setMenuOpen(false);
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
              const isSelected = activeNoteId === rec.id;
              if (onSelectNote) {
                return (
                  <div
                    key={rec.id}
                    className={`${styles.row} ${isSelected ? styles.rowActive : ""}`}
                    onClick={() => onSelectNote(rec)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectNote(rec);
                      }
                    }}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitleRow}>
                        <span className={styles.rowTitle}>{rec.title || "Untitled Note"}</span>
                      </div>
                      <div className={styles.rowPreview}>{rec.textPreview || "Empty note"}</div>
                    </div>
                    <span className={styles.rowDate}>{formatDate(rec.createdAt)}</span>
                  </div>
                );
              }
              return (
                <Link
                  key={rec.id}
                  href={`/notes/${encodeURIComponent(rec.id)}`}
                  className={`${styles.row} ${isSelected ? styles.rowActive : ""}`}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitleRow}>
                      <span className={styles.rowTitle}>{rec.title || "Untitled Note"}</span>
                    </div>
                    <div className={styles.rowPreview}>{rec.textPreview || "Empty note"}</div>
                  </div>
                  <span className={styles.rowDate}>{formatDate(rec.createdAt)}</span>
                </Link>
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
    </div>
  );
}
