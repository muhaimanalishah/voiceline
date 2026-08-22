"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RecordingItem, RecordingDetail } from "@/lib/recordings/types";
import RecordingsSidebar from "./RecordingsSidebar";
import TranscriptEditor from "./TranscriptEditor";
import AudioRecorder from "./AudioRecorder";
import styles from "./VoiceLineApp.module.css";

export default function VoiceLineApp() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewRecording, setIsNewRecording] = useState(true);
  const [selectedRecording, setSelectedRecording] =
    useState<RecordingDetail | null>(null);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await fetch("/api/recordings");
      const data = await res.json();
      if (res.ok && data.recordings) {
        setRecordings(data.recordings);
        return data.recordings as RecordingItem[];
      }
    } catch (err) {
      console.error("Failed to fetch recordings list:", err);
    } finally {
      setIsLoadingRecordings(false);
    }
    return [];
  }, []);

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
    fetchRecordings();
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
    const updatedList = await fetchRecordings();
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

    // Refresh recordings list previews & selected detail
    fetchRecordings();
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

    const updatedList = await fetchRecordings();
    if (updatedList.length > 0) {
      setSelectedId(updatedList[0].id);
      setIsNewRecording(false);
    } else {
      handleNewRecording();
    }
  };

  // Global Keyboard Shortcuts (Alt+N for new recording, Escape to go back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      // Alt+N / Ctrl+N / Cmd+N (when not in native conflict): Switch to new recording
      if ((e.altKey && e.key.toLowerCase() === "n") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !isTyping)) {
        e.preventDefault();
        handleNewRecording();
        return;
      }

      // Escape: Return to active/first note if in new recording mode
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
        selectedId={selectedId}
        isNewRecording={isNewRecording}
        onSelectRecording={handleSelectRecording}
        onNewRecording={handleNewRecording}
      />

      <main className={styles.mainContent}>
        {isLoadingRecordings ? (
          <div className={styles.loadingSpinner} />
        ) : isNewRecording ? (
          <div className={styles.recorderWrapper}>
            <div className={styles.heroIntro}>
              <h1 className={styles.heroTitle}>Record & Transcribe</h1>
              <p className={styles.heroSubtitle}>
                Capture audio in 24kbps Opus compression or drop existing audio files
                to transcribe naturally with OpenAI speech models.
              </p>
            </div>
            <AudioRecorder onRecordingCreated={handleRecordingCreated} />
          </div>
        ) : isLoadingDetail ? (
          <div className={styles.loadingSpinner} />
        ) : selectedRecording ? (
          <TranscriptEditor
            key={selectedRecording.id}
            recording={selectedRecording}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div className={styles.recorderWrapper}>
            <p>Recording not found.</p>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={handleNewRecording}
            >
              Start New Recording
            </button>
          </div>
        )}

        {/* Global Shortcuts Reference Bar */}
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
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Esc</span>
            <span>Back</span>
          </div>
        </div>
      </main>
    </div>
  );
}
