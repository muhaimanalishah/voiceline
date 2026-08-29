"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  FolderOpen,
  FileAudio,
  X,
  Sparkles,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useAudioRecorder, formatTime } from "@/hooks/useAudioRecorder";
import styles from "./AudioRecorder.module.css";

export interface AudioRecorderProps {
  onRecordingCreated?: (folderId: string) => void;
  onOpenAsk?: () => void;
  isAskOpen?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioRecorder({
  onRecordingCreated,
  onOpenAsk,
  isAskOpen,
}: AudioRecorderProps = {}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    isTranscribing,
    selectedFile,
    error: uploadError,
    setError: setUploadError,
    stageAudioFile,
    clearSelectedFile,
    processAudioUpload,
    uploadAudioBlob,
  } = useAudioUpload({ onRecordingCreated });

  const {
    isRecording,
    duration,
    error: recorderError,
    setError: setRecorderError,
    startRecording,
    stopRecording,
    discardRecording,
    canvasRef,
  } = useAudioRecorder({
    onAudioRecorded: uploadAudioBlob,
  });

  const error = recorderError || uploadError;

  // Window drag and drop handling
  useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!isRecording && !isTranscribing) {
        setIsDraggingOver(true);
      }
    };

    const onWindowDragLeave = (e: DragEvent) => {
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsDraggingOver(false);
      }
    };

    const onWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (
        !isRecording &&
        !isTranscribing &&
        e.dataTransfer?.files &&
        e.dataTransfer.files.length > 0
      ) {
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
  }, [isRecording, isTranscribing, stageAudioFile]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageAudioFile(e.target.files[0]);
    }
    e.target.value = "";
  };

  const handleStartRecording = () => {
    setUploadError(null);
    startRecording();
  };

  const handleCancelSelectedFile = () => {
    clearSelectedFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTranscribeSelectedFile = () => {
    if (!selectedFile) return;
    const fileToUpload = selectedFile;
    clearSelectedFile();
    setRecorderError(null);
    processAudioUpload(fileToUpload);
  };

  return (
    <aside
      className={`${styles.floatingWrapper} ${
        isAskOpen ? styles.floatingWrapperShifted : ""
      }`}
      aria-label="Audio Recorder"
    >
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
                onClick={handleCancelSelectedFile}
                title="Remove selected file"
                aria-label="Remove selected file"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                className={styles.transcribeFileBtn}
                onClick={handleTranscribeSelectedFile}
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
          <div className={styles.idleBar}>
            <button
              type="button"
              className={styles.recordBtn}
              onClick={handleStartRecording}
              title="Start recording (Alt+N)"
            >
              <span className={styles.pulseOrbWrap}>
                <span className={styles.pulseOrbRing} />
                <span className={styles.pulseOrbDot} />
              </span>
              <span>Start Recording</span>
              <span className={styles.kbdHint}>Alt+N</span>
            </button>

            <div className={styles.dockDivider} />

            <div className={styles.dockRightGroup}>
              <button
                type="button"
                className={styles.browseBtn}
                onClick={() => fileInputRef.current?.click()}
                title="Upload audio file"
              >
                <FolderOpen size={13} />
                <span>Upload</span>
              </button>
              {onOpenAsk && (
                <button
                  type="button"
                  className={`${styles.askBtn} ${isAskOpen ? styles.askBtnActive : ""}`}
                  onClick={onOpenAsk}
                  title="Voiceline AI about your transcriptions"
                >
                  <Sparkles size={13} className={styles.askIcon} />
                  <span>Voiceline AI</span>
                </button>
              )}
            </div>
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
