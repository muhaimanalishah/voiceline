"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  UploadCloud,
  AlertCircle,
  Trash2,
  FolderOpen,
  FileAudio,
  X,
  Sparkles,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import styles from "./AudioRecorder.module.css";

export interface AudioRecorderProps {
  onRecordingCreated?: (folderId: string) => void;
}

const MAX_RECORDING_SECONDS = 600; // 10 minutes limit
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
const ACCEPTED_EXTENSIONS = [".webm", ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".acc", ".flac"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioRecorder({ onRecordingCreated }: AudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Continuous Left-to-Right Moving Frequency Visualizer Engine
  const startMovingWaveform = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.45;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // Maintain a rolling history buffer of columns moving left-to-right
    const numBars = 45;
    const history = new Array<number>(numBars).fill(0.08);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Human speech core frequency range (roughly bins 1 to 24)
      let energy = 0;
      const startBin = 1;
      const endBin = Math.min(bufferLength, 24);
      for (let i = startBin; i < endBin; i++) {
        energy += freqData[i];
      }
      const avgEnergy = energy / (endBin - startBin); // 0 - 255

      // Calculate time-domain peak variation (deviation from 128)
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = Math.abs(timeData[i] - 128);
        if (val > peak) peak = val;
      }

      // High-sensitivity normalization curve for voice
      const freqNorm = Math.min(1.0, avgEnergy / 80);
      const peakNorm = Math.min(1.0, peak / 30);
      const combined = Math.max(freqNorm * 1.35, peakNorm * 1.2);
      const boosted = Math.pow(combined, 0.72) * 1.2;
      const amp = Math.max(0.08, Math.min(1.0, boosted));

      // Shift history leftwards and push newest amplitude to the right
      history.shift();
      history.push(amp);

      // Handle Retina / dynamic scaling
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle center baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Render moving frequency vertical rounded bars
      const barSpacing = width / numBars;
      const barWidth = Math.max(2, barSpacing - 2.5);

      for (let i = 0; i < numBars; i++) {
        const x = i * barSpacing + 1;
        const barAmp = history[i];

        // Animated organic modulation
        const wave = Math.sin((i / 4) + Date.now() / 180) * 0.04;
        const currentAmp = Math.max(0.08, Math.min(1.0, barAmp + wave));

        const barHeight = Math.max(4, currentAmp * (height - 4));
        const y = centerY - barHeight / 2;

        // Gradient from dim on left to vibrant red on recent (right)
        const progress = i / numBars;
        const alpha = 0.35 + progress * 0.65;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, `rgba(248, 113, 113, ${alpha})`);
        grad.addColorStop(0.5, `rgba(239, 68, 68, ${alpha})`);
        grad.addColorStop(1, `rgba(220, 38, 38, ${alpha})`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = Math.min(barWidth / 2, barHeight / 2);
        ctx.roundRect(x, y, barWidth, barHeight, r);
        ctx.fill();
      }
    };

    render();
  };

  const validateAudioFile = async (file: File): Promise<boolean> => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds the 25MB maximum limit.`);
      return false;
    }

    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const isAudioMime =
      file.type.startsWith("audio/") ||
      file.type.includes("video/webm") ||
      file.type.includes("video/ogg");
    const isAudioExt = ACCEPTED_EXTENSIONS.includes(extension);

    if (!isAudioMime && !isAudioExt) {
      setError("Please select a supported audio format (.mp3, .m4a, .wav, .webm, .ogg, .aac).");
      return false;
    }

    const audioDuration = await checkAudioDuration(file);
    if (Number.isFinite(audioDuration) && audioDuration > MAX_RECORDING_SECONDS) {
      const durationMins = Math.ceil(audioDuration / 60);
      setError(`Audio duration (${durationMins} mins) exceeds the 10-minute limit.`);
      return false;
    }

    return true;
  };

  const stageAudioFile = async (file: File) => {
    setError(null);
    const valid = await validateAudioFile(file);
    if (valid) {
      setSelectedFile(file);
    }
  };

  const processAudioUpload = async (file: File) => {
    const valid = await validateAudioFile(file);
    if (!valid) return;

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

    // Check if mediaDevices is supported / allowed in current context
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError(
          "Microphone access requires a secure connection (HTTPS or localhost). Mobile browsers block microphone on HTTP connections."
        );
      } else {
        setError(
          "Microphone recording is not supported on this browser or device. Please use audio upload instead."
        );
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Web Audio API Oscilloscope / Frequency Analyser
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 3.0; // amplify microphone signal for the visualizer
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.45;
        analyser.minDecibels = -85;
        analyser.maxDecibels = -10;
        source.connect(gainNode);
        gainNode.connect(analyser);

        // Small delay to ensure canvas element is mounted in DOM when recording state activates
        setTimeout(() => {
          startMovingWaveform(analyser);
        }, 50);
      } catch (audioErr) {
        console.warn("Could not start visualizer AudioContext:", audioErr);
      }

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000, // 128kbps high-fidelity voice encoding
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

  useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!isRecording && !isTranscribing) {
        setIsDraggingOver(true);
      }
    };

    const onWindowDragLeave = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDraggingOver(false);
      }
    };

    const onWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (!isRecording && !isTranscribing && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        stageAudioFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);

    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [isRecording, isTranscribing]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageAudioFile(e.target.files[0]);
    }
  };

  return (
    <aside className={styles.floatingWrapper} aria-label="Audio Recorder">
      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div
        className={`${styles.dockCapsule} ${isDraggingOver ? styles.dockCapsuleDragging : ""}`}
      >
        {/* Morphing Dropzone when a file is dragged over */}
        {isDraggingOver ? (
          <div className={styles.morphDropzone}>
            <UploadCloud size={24} className={styles.morphDropIcon} />
            <div className={styles.morphDropTitle}>Drop audio file here</div>
            <div className={styles.morphDropSubtitle}>MP3, M4A, WAV, WebM, OGG, AAC (Max 25MB)</div>
          </div>
        ) : isTranscribing ? (
          <div className={styles.transcribingBar}>
            <Spinner size="sm" />
            <span className={styles.shimmerText}>Transcribing audio...</span>
          </div>
        ) : selectedFile ? (
          /* Staged File Bar with Direct Transcribe & Cancel Buttons */
          <div className={styles.selectedFileBar}>
            <div className={styles.fileInfo}>
              <div className={styles.fileIconWrap}>
                <FileAudio size={16} />
              </div>
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>{selectedFile.name}</span>
                <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
              </div>
            </div>

            <div className={styles.fileActions}>
              <button
                type="button"
                className={styles.cancelFileBtn}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                title="Remove selected file"
                aria-label="Remove selected file"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                className={styles.transcribeFileBtn}
                onClick={() => {
                  const fileToUpload = selectedFile;
                  setSelectedFile(null);
                  processAudioUpload(fileToUpload);
                }}
                title="Transcribe selected file"
              >
                <Sparkles size={12} />
                <span>Transcribe</span>
              </button>
            </div>
          </div>
        ) : isRecording ? (
          /* Active Recording Bar with Live Oscilloscope Waveform */
          <div className={styles.recordingBar}>
            <div className={styles.recordingLeft}>
              <span className={styles.pulseOrbWrap}>
                <span className={styles.recordingPulseRing} />
                <span className={styles.recordingPulseDot} />
              </span>
              <span className={styles.timer}>{formatTime(duration)}</span>
            </div>

            <div className={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                width={260}
                height={32}
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
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                className={styles.stopBtn}
                onClick={stopRecording}
                title="Stop and transcribe note"
              >
                <span className={styles.stopSquare} />
                <span>Stop & Transcribe</span>
              </button>
            </div>
          </div>
        ) : (
          /* Unified Idle Bar: Record + Drag & Drop Prompt */
          <div className={styles.idleBar}>
            <button
              type="button"
              className={styles.recordBtn}
              onClick={startRecording}
              title="Start recording (Alt+N)"
            >
              <span className={styles.pulseOrbWrap}>
                <span className={styles.pulseOrbRing} />
                <span className={styles.pulseOrbDot} />
              </span>
              <span>Start Recording</span>
              <span className={styles.kbdHint}>Alt+N</span>
            </button>

            <div className={styles.idleCenter}>
              <span className={styles.idleMainText}>or drop audio anywhere</span>
              <span className={styles.idleSubText}>128kbps • 10 min limit</span>
            </div>

            <button
              type="button"
              className={styles.browseBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Upload audio file"
            >
              <FolderOpen size={13} />
              <span>Upload</span>
            </button>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="audio/*,.webm,.mp3,.m4a,.wav,.ogg,.aac,.acc,.flac"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>
    </aside>
  );
}
