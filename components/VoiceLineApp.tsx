"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { RecordingItem, RecordingDetail } from "@/lib/recordings/types";
import RecordingsSidebar from "./RecordingsSidebar";
import TranscriptEditor from "./TranscriptEditor";
import AudioRecorder from "./AudioRecorder";
import styles from "./VoiceLineApp.module.css";

const PAGE_SIZE = 15;

export default function VoiceLineApp() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewRecording, setIsNewRecording] = useState(true);
  const [selectedRecording, setSelectedRecording] =
    useState<RecordingDetail | null>(null);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchRecordings = useCallback(async (page: number = 1, append: boolean = false) => {
    if (append) setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/recordings?page=${page}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (res.ok && data.recordings) {
        setRecordings((prev) => (append ? [...prev, ...data.recordings] : data.recordings));
        setTotalCount(data.total || 0);
        setHasMore(data.hasMore || false);
        setCurrentPage(data.page || 1);
        return data.recordings as RecordingItem[];
      }
    } catch (err) {
      console.error("Failed to fetch recordings list:", err);
    } finally {
      setIsLoadingRecordings(false);
      setIsLoadingMore(false);
    }
    return [];
  }, []);

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      fetchRecordings(currentPage + 1, true);
    }
  };

  const fetchRecordingDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok && data.recording) {
        setSelectedRecording(data.recording);
      } else {
        setSelectedRecording(null);
      }
    } catch (err) {
      console.error("Failed to fetch recording detail:", err);
      setSelectedRecording(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRecordings(1, false);
  }, [fetchRecordings]);

  // Load detail when selectedId changes and not in new recording mode
  useEffect(() => {
    if (selectedId && !isNewRecording) {
      fetchRecordingDetail(selectedId);
    } else {
      setSelectedRecording(null);
    }
  }, [selectedId, isNewRecording, fetchRecordingDetail]);

  const handleSelectRecording = useCallback((id: string) => {
    setSelectedId(id);
    setIsNewRecording(false);
  }, []);

  const handleNewRecording = useCallback(() => {
    setIsNewRecording(true);
    setSelectedId(null);
    setSelectedRecording(null);
  }, []);

  const handleRecordingCreated = async (folderId: string) => {
    const updatedList = await fetchRecordings(1, false);
    if (updatedList.some((item) => item.id === folderId)) {
      setSelectedId(folderId);
      setIsNewRecording(false);
    }
  };

  const handleUpdate = async (
    id: string,
    newText: string,
    newTitle?: string
  ) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: newText, title: newTitle }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to update transcription.");
    }

    // Refresh current recordings in list
    setRecordings((prev) =>
      prev.map((rec) =>
        rec.id === id
          ? {
              ...rec,
              title: newTitle ?? rec.title,
              textPreview:
                newText.length > 120
                  ? newText.slice(0, 120).trim() + "..."
                  : newText,
            }
          : rec
      )
    );

    setSelectedRecording((prev) =>
      prev && prev.id === id
        ? { ...prev, text: newText, title: newTitle ?? prev.title }
        : prev
    );
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to delete recording.");
    }

    const updatedList = await fetchRecordings(1, false);
    if (updatedList.length > 0) {
      setSelectedId(updatedList[0].id);
      setIsNewRecording(false);
    } else {
      handleNewRecording();
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      // Alt+N / Cmd+N / Ctrl+N (when not focused in textarea)
      if (
        (e.altKey && e.key.toLowerCase() === "n") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !isTyping)
      ) {
        e.preventDefault();
        handleNewRecording();
        return;
      }

      // Escape: Return from recorder view to active/first note
      if (e.key === "Escape" && isNewRecording && recordings.length > 0) {
        e.preventDefault();
        handleSelectRecording(selectedId || recordings[0].id);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewRecording, handleSelectRecording, isNewRecording, recordings, selectedId]);

  return (
    <div className={styles.appLayout}>
      <RecordingsSidebar
        recordings={recordings}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        selectedId={selectedId}
        isNewRecording={isNewRecording}
        onSelectRecording={handleSelectRecording}
        onNewRecording={handleNewRecording}
        onLoadMore={handleLoadMore}
      />

      <main className={styles.mainContent}>
        {isLoadingRecordings ? (
          <div className={styles.loadingSpinner}>
            <Loader2 size={32} style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : isNewRecording ? (
          <div className={styles.recorderWorkspace}>
            <AudioRecorder onRecordingCreated={handleRecordingCreated} />
          </div>
        ) : isLoadingDetail ? (
          <div className={styles.loadingSpinner}>
            <Loader2 size={32} style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : selectedRecording ? (
          <TranscriptEditor
            key={selectedRecording.id}
            recording={selectedRecording}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div className={styles.recorderWorkspace}>
            <AudioRecorder onRecordingCreated={handleRecordingCreated} />
          </div>
        )}

        {/* Global Shortcut Cheat-sheet Bar */}
        <div className={styles.shortcutBar}>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Alt+N</span>
            <span>New</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Ctrl+S</span>
            <span>Save</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Space</span>
            <span>Play/Pause</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Alt+C</span>
            <span>Copy</span>
          </div>
        </div>
      </main>
    </div>
  );
}
