export interface RecordingItem {
  id: string;
  title?: string;
  createdAt: string;
  textPreview: string;
  model: string;
  audioFile: string;
  audioUrl: string;
  audioStatus?: "active" | "deleted";
  audioKey?: string;
  hasTranscript: boolean;
  size?: number;
  duration?: number | null;
}

export interface RecordingDetail {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
  text: string;
  rawTranscript?: string;
  model: string;
  audioFile: string;
  audioUrl: string;
  audioStatus?: "active" | "deleted";
  audioKey?: string;
  duration: number | null;
  size?: number;
  transcriptionJsonUrl?: string;
}

export interface TranscriptionJsonData {
  title?: string;
  text: string;
  rawTranscript?: string;
  model: string;
  createdAt: string;
  audioFile: string;
  audioStatus?: "active" | "deleted";
  audioKey?: string;
  duration?: number | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedRecordings {
  recordings: RecordingItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NewRecordingInput {
  id: string;
  title?: string;
  transcript: string;
  rawTranscript: string;
  modelUsed?: string;
  audioKey?: string;
  audioStatus?: "active" | "deleted";
  audioUrl?: string;
  audioFile?: string;
  duration?: number | null;
  size?: number;
  createdAt?: string;
}

export interface RecordingStore {
  getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings>;
  getRecordingById(id: string): Promise<RecordingDetail | null>;
  updateTranscription(id: string, newText: string, newTitle?: string): Promise<boolean>;
  updateRecording?(id: string, updates: { text?: string; title?: string }): Promise<boolean>;
  deleteAudioOnly?(id: string): Promise<boolean>;
  resetToRawTranscript?(id: string): Promise<boolean>;
  saveRecording?(data: NewRecordingInput): Promise<boolean>;
  deleteRecording(id: string): Promise<boolean>;
}
