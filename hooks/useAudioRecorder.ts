import { useState, useRef, useEffect, useCallback } from "react";
import { useWaveformVisualizer } from "./useWaveformVisualizer";

const MAX_RECORDING_SECONDS = 600; // 10 minutes limit

export interface UseAudioRecorderOptions {
  onAudioRecorded?: (blob: Blob, mimeType: string) => Promise<void> | void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getSupportedMimeType(): string {
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
}

export function useAudioRecorder({
  onAudioRecorded,
  canvasRef: externalCanvasRef,
}: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isDiscardingRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { startVisualizer, stopVisualizer } = useWaveformVisualizer({ canvasRef });

  const cleanupRecordingSession = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    stopVisualizer();
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
  }, [stopVisualizer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopVisualizer();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopVisualizer]);

  // Normal Stop & Transcribe
  const stopRecording = useCallback(() => {
    isDiscardingRef.current = false;
    cleanupRecordingSession();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, [cleanupRecordingSession]);

  // Cancel & Discard Recording without saving
  const discardRecording = useCallback(() => {
    isDiscardingRef.current = true;
    audioChunksRef.current = [];
    cleanupRecordingSession();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, [cleanupRecordingSession]);

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

  const startRecording = useCallback(async () => {
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
          startVisualizer(analyser);
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

        if (onAudioRecorded) {
          await onAudioRecorded(audioBlob, recordedMimeType);
        }
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
  }, [onAudioRecorded, startVisualizer, stopRecording]);

  return {
    isRecording,
    duration,
    error,
    setError,
    startRecording,
    stopRecording,
    discardRecording,
    canvasRef,
  };
}
