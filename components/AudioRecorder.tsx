"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./AudioRecorder.module.css";

interface UploadedFileInfo {
  folderId: string;
  filename: string;
  url: string;
  filepath: string;
  size: number;
  mimeType: string;
}

interface TranscriptionInfo {
  text: string;
  model: string;
  createdAt: string;
  audioFile: string;
  folderId: string;
  transcriptionJsonUrl: string;
}

export interface AudioRecorderProps {
  onRecordingCreated?: (folderId: string) => void;
}

export default function AudioRecorder({ onRecordingCreated }: AudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up timer and streams on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  // Determine optimal low-bitrate MIME type
  const getSupportedMimeType = (): string => {
    if (typeof window === "undefined" || !window.MediaRecorder) {
      return "";
    }

    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];

    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const transcribeAudio = async (folderId: string) => {
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio.");
      }

      setTranscription(data);
      if (onRecordingCreated) {
        onRecordingCreated(folderId);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Transcription failed.";
      setTranscribeError(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleUpload = async (audioBlob: Blob, mimeType: string) => {
    setIsUploading(true);
    setError(null);
    setTranscription(null);
    setTranscribeError(null);

    try {
      let extension = "webm";
      if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
        extension = "mp4";
      } else if (mimeType.includes("ogg")) {
        extension = "ogg";
      } else if (mimeType.includes("wav")) {
        extension = "wav";
      }

      const file = new File([audioBlob], `audio.${extension}`, {
        type: mimeType || audioBlob.type || "audio/webm",
      });

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload audio file.");
      }

      setUploadedFile(data);

      // Trigger automatic OpenAI transcription for the newly created recording subfolder
      if (data.folderId) {
        await transcribeAudio(data.folderId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload audio.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    setTranscribeError(null);
    setUploadedFile(null);
    setTranscription(null);

    if (localAudioUrl) {
      URL.revokeObjectURL(localAudioUrl);
      setLocalAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono audio is ideal and lightweight for speech
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 24000, // 24kbps for ultra-light speech storage
      };
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordedMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recordedMimeType,
        });

        const previewUrl = URL.createObjectURL(audioBlob);
        setLocalAudioUrl(previewUrl);

        // Upload recorded audio
        await handleUpload(audioBlob, recordedMimeType);

        // Stop all media tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // Request data in chunks (every 1s) for stream stability
      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to access microphone.";
      setError(`Microphone access error: ${message}`);
    }
  };

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }, []);

  const handleCopy = async () => {
    if (!transcription?.text) return;
    try {
      await navigator.clipboard.writeText(transcription.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Voice Recorder</h2>
        <p className={styles.subtitle}>
          Optimized speech recording (24kbps Opus) & AI transcription
        </p>
      </div>

      <div className={styles.statusArea}>
        {isRecording ? (
          <>
            <div className={styles.timer}>
              <span className={styles.liveIndicator} />
              {formatTime(duration)}
            </div>
            <div className={styles.waveform}>
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
            </div>
          </>
        ) : isUploading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Saving audio to server...</span>
          </div>
        ) : isTranscribing ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Transcribing with OpenAI...</span>
          </div>
        ) : (
          <div className={styles.configNotice}>
            <span>Target format: <strong>audio/webm (24 kbps)</strong></span>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className={styles.actions}>
        {!isRecording ? (
          <button
            type="button"
            className={styles.recordBtn}
            onClick={startRecording}
            disabled={isUploading || isTranscribing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" fill="#ef4444" />
            </svg>
            {uploadedFile ? "Record Again" : "Start Recording"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={stopRecording}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop & Save
          </button>
        )}
      </div>

      {uploadedFile && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <span className={styles.badge}>✓ Saved to public/uploads/{uploadedFile.folderId}</span>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Folder</span>
              <span className={styles.metaValue}>{uploadedFile.folderId}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Size</span>
              <span className={styles.metaValue}>
                {formatFileSize(uploadedFile.size)}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>MIME Type</span>
              <span className={styles.metaValue}>{uploadedFile.mimeType}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Codec Bitrate</span>
              <span className={styles.metaValue}>24 kbps</span>
            </div>
          </div>

          {localAudioUrl && (
            <audio
              className={styles.audioPlayer}
              controls
              src={localAudioUrl}
              preload="metadata"
            >
              Your browser does not support the audio element.
            </audio>
          )}

          {/* Transcription section */}
          {isTranscribing && (
            <div className={styles.transcriptionLoading}>
              <div className={styles.spinner} />
              <span>Transcribing audio with OpenAI...</span>
            </div>
          )}

          {transcribeError && (
            <div className={styles.errorBox} style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
              <div>⚠️ {transcribeError}</div>
              {uploadedFile && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => transcribeAudio(uploadedFile.folderId)}
                >
                  Retry Transcription
                </button>
              )}
            </div>
          )}

          {transcription && (
            <div className={styles.transcriptionBox}>
              <div className={styles.transcriptionHeader}>
                <div className={styles.transcriptionTitle}>
                  <span>Transcription</span>
                  <span className={styles.modelBadge}>{transcription.model}</span>
                </div>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={handleCopy}
                  title="Copy transcription"
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>

              <p className={styles.transcriptionText} dir="auto">
                {transcription.text}
              </p>

              <div className={styles.storageNote}>
                💾 Metadata saved to <code>public/uploads/{uploadedFile.folderId}/transcription.json</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
