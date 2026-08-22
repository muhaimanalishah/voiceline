"use client";

import React, { useState } from "react";
import { RecordingItem } from "@/lib/recordings/types";
import styles from "./RecordingsSidebar.module.css";

interface RecordingsSidebarProps {
  recordings: RecordingItem[];
  selectedId: string | null;
  isNewRecording: boolean;
  onSelectRecording: (id: string) => void;
  onNewRecording: () => void;
}

export default function RecordingsSidebar({
  recordings,
  selectedId,
  isNewRecording,
  onSelectRecording,
  onNewRecording,
}: RecordingsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecordings = recordings.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
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
        return `Today, ${date.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`;
      }

      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
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
            <svg
              className={styles.brandIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            <span>VoiceLine</span>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.newBtn} ${
            isNewRecording ? styles.newBtnActive : ""
          }`}
          onClick={onNewRecording}
        >
          <span>＋</span>
          <span>New Recording</span>
        </button>

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.listContainer}>
        {filteredRecordings.length === 0 ? (
          <div className={styles.emptyState}>
            <span>🎙️</span>
            <span>
              {searchQuery ? "No matching transcripts found" : "No recordings yet"}
            </span>
          </div>
        ) : (
          filteredRecordings.map((rec) => {
            const isSelected = !isNewRecording && selectedId === rec.id;
            return (
              <button
                key={rec.id}
                type="button"
                className={`${styles.itemCard} ${
                  isSelected ? styles.itemActive : ""
                }`}
                onClick={() => onSelectRecording(rec.id)}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.itemDate}>
                    {formatDate(rec.createdAt)}
                  </span>
                  {rec.size ? (
                    <span>{(rec.size / 1024).toFixed(0)} KB</span>
                  ) : null}
                </div>

                <p className={styles.itemSnippet} dir="auto">
                  {rec.textPreview}
                </p>

                <div className={styles.itemFooter}>
                  <span>🔊 {rec.audioFile}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.itemCount}>
        {recordings.length} {recordings.length === 1 ? "recording" : "recordings"} stored locally
      </div>
    </aside>
  );
}
