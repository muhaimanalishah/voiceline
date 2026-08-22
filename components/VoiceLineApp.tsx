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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  const handleSelectRecording = (id: string) => {
    setSelectedId(id);
    setIsNewRecording(false);
    setIsMobileSidebarOpen(false);
  };

  const handleNewRecording = () => {
    setIsNewRecording(true);
    setSelectedId(null);
    setSelectedRecording(null);
    setIsMobileSidebarOpen(false);
  };

  const handleRecordingCreated = async (folderId: string) => {
    const updatedList = await fetchRecordings();
    if (updatedList.some((item) => item.id === folderId)) {
      setSelectedId(folderId);
      setIsNewRecording(false);
    }
  };

  const handleUpdate = async (id: string, newText: string) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: newText }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to update transcription.");
    }

    // Refresh recordings list previews & selected detail
    fetchRecordings();
    setSelectedRecording((prev) =>
      prev && prev.id === id ? { ...prev, text: newText } : prev
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
                Capture audio in 24kbps Opus compression and transcribe naturally
                using OpenAI speech models.
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
      </main>
    </div>
  );
}
