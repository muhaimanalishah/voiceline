export interface TagItem {
  id: string;
  name: string;
  description: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagWithCount extends TagItem {
  recordingCount: number;
}

export interface NewTagInput {
  id?: string;
  name: string;
  description: string;
  color?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  description?: string;
  color?: string | null;
}

export interface RecordingItem {
  id: string;
  tagId?: string | null;
  title?: string;
  createdAt: string;
  textPreview: string;
  model: string;
  hasTranscript: boolean;
  duration?: number | null;
}

export interface RecordingDetail {
  id: string;
  tagId?: string | null;
  title?: string;
  createdAt: string;
  updatedAt?: string;
  text: string;
  rawTranscript?: string;
  model: string;
  duration?: number | null;
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
  tagId?: string | null;
  title?: string;
  transcript: string;
  rawTranscript: string;
  modelUsed?: string;
  duration?: number | null;
  createdAt?: string;
}

export interface RecordingStore {
  getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings>;
  getRecordingsByTag(
    tagId: string | null,
    options?: PaginationOptions
  ): Promise<PaginatedRecordings>;
  getRecordingById(id: string): Promise<RecordingDetail | null>;
  updateRecording(
    id: string,
    updates: { text?: string; title?: string; tagId?: string | null }
  ): Promise<boolean>;
  resetToRawTranscript(id: string): Promise<boolean>;
  saveRecording(data: NewRecordingInput): Promise<boolean>;
  deleteRecording(id: string): Promise<boolean>;
  getAllTags(): Promise<TagItem[]>;
  getAllTagsWithCounts(): Promise<TagWithCount[]>;
  getUnclassifiedCount(): Promise<number>;
  getTagById(id: string): Promise<TagItem | null>;
  createTag(data: NewTagInput): Promise<TagItem>;
  updateTag(id: string, updates: UpdateTagInput): Promise<TagItem | null>;
  deleteTag(id: string): Promise<boolean>;
}



