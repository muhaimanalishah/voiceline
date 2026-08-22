"use client";

import React, { useState } from "react";
import {
  Mic,
  Plus,
  Search,
  FileText,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { RecordingItem } from "@/lib/recordings/types";
import styles from "./RecordingsSidebar.module.css";

interface RecordingsSidebarProps {
  recordings: RecordingItem[];
  totalCount: number;
  hasMore: boolean;
  isLoadingMore?: boolean;
  selectedId: string | null;
  isNewRecording: boolean;
  onSelectRecording: (id: string) => void;
  onNewRecording: () => void;
  onLoadMore?: () => void;
}

export default function RecordingsSidebar({
  recordings,
  totalCount,
  hasMore,
  isLoadingMore = false,
  selectedId,
  isNewRecording,
  onSelectRecording,
  onNewRecording,
  onLoadMore,
}: RecordingsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecordings = recordings.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(query)) ||
      item.textPreview.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.model.toLowerCase().includes(query)
    );
  });

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
      }

      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <Mic className={styles.brandIcon} size={16} />
            <span>VoiceLine</span>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.newBtn} ${
            isNewRecording ? styles.newBtnActive : ""
          }`}
          onClick={onNewRecording}
          title="New Note (Alt+N)"
        >
          <div className={styles.newBtnLabel}>
            <Plus size={14} />
            <span>New Note</span>
          </div>
          <span className={styles.shortcutHint}>⌥N</span>
        </button>

        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} size={13} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.listContainer}>
        {filteredRecordings.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={20} />
            <span>
              {searchQuery ? "No matching notes found" : "No notes yet"}
            </span>
          </div>
        ) : (
          filteredRecordings.map((rec) => {
            const isSelected = !isNewRecording && selectedId === rec.id;
            return (
              <button
                key={rec.id}
                type="button"
                className={`${styles.itemRow} ${
                  isSelected ? styles.itemActive : ""
                }`}
                onClick={() => onSelectRecording(rec.id)}
                title={rec.title || rec.id}
              >
                <span className={styles.itemTitle}>
                  {rec.title || rec.id}
                </span>
                <span className={styles.itemDate}>
                  {formatDate(rec.createdAt)}
                </span>
              </button>
            );
          })
        )}

        {hasMore && !searchQuery && (
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                <span>Load More</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className={styles.footer}>
        <span>{totalCount || recordings.length} notes</span>
        <span>VoiceLine</span>
      </div>
    </aside>
  );
}
