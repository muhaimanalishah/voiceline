"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  UploadCloud,
  AlertCircle,
  Loader2,
  Radio,
} from "lucide-react";
import styles from "./AudioRecorder.module.css";

export interface AudioRecorderProps {
  onRecordingCreated?: (folderId: string) => void;
}

const MAX_RECORDING_SECONDS = 600; // 10 minutes limit
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
const ACCEPTED_EXTENSIONS = [".webm", ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"];

export default function AudioRecorder({ onRecordingCreated }: AudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    };
  }, []);

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

  const checkAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        const objectUrl = URL.createObjectURL(file);
        audio.src = objectUrl;

        const cleanup = () => {
          URL.revokeObjectURL(objectUrl);
        };

        audio.onloadedmetadata = () => {
          let duration = audio.duration;

          // In Chrome/Chromium, WebM blobs from MediaRecorder report duration as Infinity until sought
          if (duration === Infinity || isNaN(duration)) {
            audio.currentTime = 1e101;
            audio.ontimeupdate = () => {
              audio.ontimeupdate = null;
              duration = audio.duration;
              if (duration === Infinity || isNaN(duration)) {
                duration = audio.currentTime;
              }
              cleanup();
              resolve(Number.isFinite(duration) ? duration : 0);
            };
            return;
          }

          cleanup();
          resolve(Number.isFinite(duration) ? duration : 0);
        };

        audio.onerror = () => {
          cleanup();
          resolve(0); // If browser cannot probe duration, allow upload to proceed
        };

        // Fallback timeout in case metadata event never fires
        setTimeout(() => {
          cleanup();
          resolve(0);
        }, 1500);
      } catch {
        resolve(0);
      }
    });
  };

  const processAudioUpload = async (file: File) => {
    // 1. File Size Validation
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds the 25MB maximum limit.`);
      return;
    }

    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const isAudioMime =
      file.type.startsWith("audio/") ||
      file.type.includes("video/webm") ||
      file.type.includes("video/ogg");
    const isAudioExt = ACCEPTED_EXTENSIONS.includes(extension);

    if (!isAudioMime && !isAudioExt) {
      setError("Please select a supported audio format (.mp3, .m4a, .wav, .webm, .ogg, .aac).");
      return;
    }

    // 2. Duration Validation
    const audioDuration = await checkAudioDuration(file);
    if (Number.isFinite(audioDuration) && audioDuration > MAX_RECORDING_SECONDS) {
      const durationMins = Math.ceil(audioDuration / 60);
      setError(`Audio duration (${durationMins} mins) exceeds the 10-minute limit.`);
      return;
    }

    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio.");
      }

      if (data.id && onRecordingCreated) {
        onRecordingCreated(data.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process audio.";
      setError(message);
    } finally {
      setIsTranscribing(false);
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

    const file = new File([audioBlob], `voice-recording.${extension}`, {
      type: mimeType || audioBlob.type || "audio/webm",
    });

    await processAudioUpload(file);
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

  const startRecording = async () => {
    setError(null);

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

        await handleUploadBlob(audioBlob, recordedMimeType);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      // Auto-stop at 10 minutes (600s)
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            setError("Maximum recording limit of 10 minutes reached.");
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to access microphone.";
      setError(`Microphone error: ${message}`);
    }
  };

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
      processAudioUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAudioUpload(e.target.files[0]);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Voice Note</h2>
        <p className={styles.subtitle}>
          Record live speech or drop existing audio files to generate instant transcripts.
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
            <span className={styles.limitNote}>Max 10 minutes</span>
          </>
        ) : isTranscribing ? (
          <div className={styles.loadingContainer}>
            <Loader2 className={styles.spinner} size={20} />
            <span>Transcribing with OpenAI...</span>
          </div>
        ) : (
          <div className={styles.loadingContainer}>
            <Radio size={16} style={{ color: "#71717a" }} />
            <span className={styles.limitNote}>24kbps Opus • 10 min max</span>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.actions}>
        {!isRecording ? (
          <button
            type="button"
            className={styles.recordBtn}
            onClick={startRecording}
            disabled={isTranscribing}
          >
            <Mic size={18} />
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={stopRecording}
          >
            <Square size={16} fill="currentColor" />
            <span>Stop & Transcribe</span>
          </button>
        )}
      </div>

      {!isRecording && !isTranscribing && (
        <>
          <div className={styles.divider}>
            <span>Or Upload File</span>
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
            <UploadCloud className={styles.dropIcon} size={28} />
            <div className={styles.dropTitle}>
              {isDraggingOver
                ? "Drop audio file here..."
                : "Drop audio file here or click to browse"}
            </div>
            <div className={styles.dropSubtitle}>
              MP3, M4A, WAV, WebM, OGG, AAC • Max 10 min / 25MB
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
    </div>
  );
}
