export interface RecordingItem {
  id: string;
  title?: string;
  createdAt: string;
  textPreview: string;
  model: string;
  audioFile: string;
  audioUrl: string;
  hasTranscript: boolean;
  size?: number;
  duration?: number | null;
}

export interface RecordingDetail {
  id: string;
  title?: string;
  createdAt: string;
  text: string;
  model: string;
  audioFile: string;
  audioUrl: string;
  duration: number | null;
  size?: number;
  transcriptionJsonUrl: string;
}

export interface TranscriptionJsonData {
  title?: string;
  text: string;
  model: string;
  createdAt: string;
  audioFile: string;
  duration?: number | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface RecordingStore {
  getAllRecordings(): Promise<RecordingItem[]>;
  getRecordingById(id: string): Promise<RecordingDetail | null>;
  updateTranscription(id: string, newText: string, newTitle?: string): Promise<boolean>;
  updateRecording?(id: string, updates: { text?: string; title?: string }): Promise<boolean>;
  deleteRecording(id: string): Promise<boolean>;
}
