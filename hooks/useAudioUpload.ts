import { useState } from "react";

const MAX_RECORDING_SECONDS = 600; // 10 minutes limit
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
const ACCEPTED_EXTENSIONS = [".webm", ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".acc", ".flac"];

export interface UseAudioUploadOptions {
  onRecordingCreated?: (id: string) => void;
}

export function checkAudioDuration(file: File): Promise<number> {
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
}

export function useAudioUpload({ onRecordingCreated }: UseAudioUploadOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateAudioFile = async (file: File): Promise<boolean> => {
    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds the 25MB maximum limit.");
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

  const clearSelectedFile = () => {
    setSelectedFile(null);
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

  const uploadAudioBlob = async (audioBlob: Blob, mimeType: string) => {
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

  return {
    isTranscribing,
    selectedFile,
    error,
    setError,
    stageAudioFile,
    clearSelectedFile,
    processAudioUpload,
    uploadAudioBlob,
  };
}
