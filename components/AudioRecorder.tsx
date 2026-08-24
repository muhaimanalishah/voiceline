"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  UploadCloud,
  AlertCircle,
  Loader2,
  Trash2,
  FolderOpen,
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
  const isDiscardingRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
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
          resolve(0);
        };

        setTimeout(() => {
          cleanup();
          resolve(0);
        }, 1500);
      } catch {
        resolve(0);
      }
    });
  };

  // Continuous Left-to-Right Moving Oscilloscope Waveform Engine
  const startMovingWaveform = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const timeDomainData = new Uint8Array(bufferLength);

    // Maintain a rolling history buffer for smooth left-to-right streaming
    const historyLength = 180;
    const history = new Array<number>(historyLength).fill(0);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(timeDomainData);

      // Compute root-mean-square / max peak amplitude for this frame
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const norm = (timeDomainData[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / bufferLength);
      // Smooth amplitude gain
      const targetAmp = Math.min(1, rms * 3.5);

      // Shift history leftwards and push newest amplitude on right
      history.shift();
      history.push(targetAmp);

      // Clear canvas with transparent alpha
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw Center Baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Top and Bottom Waveform Path
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.2)");
      gradient.addColorStop(0.7, "#f87171");
      gradient.addColorStop(1, "#ef4444");

      ctx.lineWidth = 2;
      ctx.strokeStyle = gradient;
      ctx.fillStyle = "rgba(239, 68, 68, 0.12)";

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      const step = width / (historyLength - 1);
      for (let i = 0; i < historyLength; i++) {
        const x = i * step;
        const amp = history[i];
        // Calculate organic sine variation on amplitude
        const wave = Math.sin((i / 8) + Date.now() / 150) * 0.15;
        const offset = (amp * (height * 0.44)) + (amp > 0.02 ? wave * (height * 0.2) : 0);
        const y = centerY - Math.max(1, offset);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Mirror bottom half
      for (let i = historyLength - 1; i >= 0; i--) {
        const x = i * step;
        const amp = history[i];
        const wave = Math.sin((i / 8) + Date.now() / 150) * 0.15;
        const offset = (amp * (height * 0.44)) + (amp > 0.02 ? wave * (height * 0.2) : 0);
        const y = centerY + Math.max(1, offset);
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    render();
  };

  const processAudioUpload = async (file: File) => {
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

  const cleanupRecordingSession = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setDuration(0);
  };

  // Normal Stop & Transcribe
  const stopRecording = useCallback(() => {
    isDiscardingRef.current = false;
    cleanupRecordingSession();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Cancel & Discard Recording without saving
  const discardRecording = useCallback(() => {
    isDiscardingRef.current = true;
    audioChunksRef.current = [];
    cleanupRecordingSession();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Esc key cancels recording if active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isRecording) {
        e.preventDefault();
        discardRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, discardRecording]);

  const startRecording = async () => {
    setError(null);
    isDiscardingRef.current = false;

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

      // Web Audio API Oscilloscope Analyser
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        startMovingWaveform(analyser);
      } catch (audioErr) {
        console.warn("Could not start visualizer AudioContext:", audioErr);
      }

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
        if (!isDiscardingRef.current && event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (isDiscardingRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const recordedMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recordedMimeType,
        });

        await handleUploadBlob(audioBlob, recordedMimeType);
      };

      mediaRecorder.start(500);
      setIsRecording(true);
      setDuration(0);

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
    if (!isRecording && !isTranscribing) {
      setIsDraggingOver(true);
    }
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

    if (!isRecording && !isTranscribing && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAudioUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAudioUpload(e.target.files[0]);
    }
  };

  return (
    <div
      className={`${styles.container} ${isDraggingOver ? styles.containerDragging : ""}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Morphing Dropzone when a file is dragged over */}
      {isDraggingOver ? (
        <div className={styles.morphDropzone}>
          <UploadCloud size={28} className={styles.morphDropIcon} />
          <div className={styles.morphDropTitle}>Drop audio file to transcribe</div>
          <div className={styles.morphDropSubtitle}>MP3, M4A, WAV, WebM, OGG, AAC (Max 25MB)</div>
        </div>
      ) : isTranscribing ? (
        <div className={styles.transcribingBar}>
          <Loader2 className={styles.spinner} size={18} />
          <span>Transcribing audio with OpenAI...</span>
        </div>
      ) : isRecording ? (
        /* Active Recording Bar with Live Oscilloscope Waveform */
        <div className={styles.recordingBar}>
          <div className={styles.recordingLeft}>
            <span className={styles.liveIndicator} />
            <span className={styles.timer}>{formatTime(duration)}</span>
          </div>

          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              width={340}
              height={40}
              className={styles.visualizerCanvas}
            />
          </div>

          <div className={styles.recordingActions}>
            <button
              type="button"
              className={styles.discardBtn}
              onClick={discardRecording}
              title="Discard recording (Esc)"
              aria-label="Discard recording"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              className={styles.stopBtn}
              onClick={stopRecording}
              title="Stop and transcribe note"
            >
              <Square size={13} fill="currentColor" />
              <span>Stop & Transcribe</span>
            </button>
          </div>
        </div>
      ) : (
        /* Unified Idle Bar: Record + Drag & Drop Prompt */
        <div className={styles.idleBar}>
          <div className={styles.idleLeft}>
            <button
              type="button"
              className={styles.recordBtn}
              onClick={startRecording}
              title="Start recording (Alt+N)"
            >
              <Mic size={15} />
              <span>Start Recording</span>
            </button>
            <div className={styles.idlePrompt}>
              <span className={styles.idleMainText}>or drag & drop audio file anywhere</span>
              <span className={styles.idleSubText}>24kbps Opus • 10 min limit</span>
            </div>
          </div>

          <button
            type="button"
            className={styles.browseBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Browse audio file"
          >
            <FolderOpen size={14} />
            <span>Browse</span>
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.webm,.mp3,.m4a,.wav,.ogg,.aac,.flac"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
    </div>
  );
}
