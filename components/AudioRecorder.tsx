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
  title?: string;
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

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB OpenAI limit
const ACCEPTED_EXTENSIONS = [".webm", ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"];

export default function AudioRecorder({ onRecordingCreated }: AudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const processAudioUpload = async (file: File) => {
    // Validation
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${formatFileSize(file.size)}) exceeds the 25MB limit.`);
      return;
    }

    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const isAudioMime = file.type.startsWith("audio/") || file.type.includes("video/webm") || file.type.includes("video/ogg");
    const isAudioExt = ACCEPTED_EXTENSIONS.includes(extension);

    if (!isAudioMime && !isAudioExt) {
      setError("Please provide a valid audio file (.mp3, .m4a, .wav, .webm, .ogg, .aac).");
      return;
    }

    setIsUploading(true);
    setError(null);
    setTranscription(null);
    setTranscribeError(null);

    try {
      const previewUrl = URL.createObjectURL(file);
      setLocalAudioUrl(previewUrl);

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

  const handleUploadBlob = async (audioBlob: Blob, mimeType: string) => {
    let extension = "webm";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
      extension = "m4a";
    } else if (mimeType.includes("ogg")) {
      extension = "ogg";
    } else if (mimeType.includes("wav")) {
      extension = "wav";
    }

    const file = new File([audioBlob], `recorded-voice.${extension}`, {
      type: mimeType || audioBlob.type || "audio/webm",
    });

    await processAudioUpload(file);
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
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 24000,
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

        await handleUploadBlob(audioBlob, recordedMimeType);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

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

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processAudioUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processAudioUpload(file);
    }
  };

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
        <h2 className={styles.title}>Record or Upload Audio</h2>
        <p className={styles.subtitle}>
          Capture live speech (24kbps Opus) or upload existing audio files
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
            <span className={styles.loadingText}>Uploading audio...</span>
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

      {/* Drag & Drop Audio Upload Zone */}
      {!isRecording && !isUploading && !isTranscribing && (
        <>
          <div className={styles.divider}>
            <span>Or Upload Audio File</span>
          </div>

          <div
            className={`${styles.dropZone} ${
              isDraggingOver ? styles.dropZoneActive : ""
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className={styles.dropZoneIcon}>📁</span>
            <div className={styles.dropZoneTitle}>
              {isDraggingOver
                ? "Drop the audio file right here..."
                : "Drag & drop audio file here or click to browse"}
            </div>
            <div className={styles.dropZoneSubtitle}>
              Supports MP3, M4A, WAV, WebM, OGG, AAC (Max 25MB)
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.webm,.mp3,.m4a,.wav,.ogg,.aac,.flac"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </>
      )}

      {uploadedFile && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <span className={styles.badge}>✓ Saved ({uploadedFile.folderId})</span>
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
              <span className={styles.metaLabel}>Codec / Quality</span>
              <span className={styles.metaValue}>Voice Optimized</span>
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

          {isTranscribing && (
            <div className={styles.transcriptionLoading}>
              <div className={styles.spinner} />
              <span>Transcribing audio with OpenAI...</span>
            </div>
          )}

          {transcribeError && (
            <div
              className={styles.errorBox}
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.5rem",
              }}
            >
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
                💾 Saved to storage (<code>{uploadedFile.folderId}</code>)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
