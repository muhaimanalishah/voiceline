import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TranscriptionJsonData,
} from "./types";
import { fsRecordingStore } from "./fs-store";
import { drizzleRecordingStore } from "./drizzle-store";
import { r2RecordingStore } from "./r2-store";

export type {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TranscriptionJsonData,
};

export { fsRecordingStore, drizzleRecordingStore, r2RecordingStore };

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

export function validateCloudEnv(): EnvValidationResult {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function isLocalMode(): boolean {
  return process.env.APP_MODE === "local";
}

/**
 * CloudRecordingStore combines PostgreSQL (via Drizzle ORM) for note & transcript metadata
 * and Cloudflare R2 (via S3 SDK) for audio storage.
 */
export class CloudRecordingStore implements RecordingStore {
  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    if (!process.env.DATABASE_URL) {
      console.warn("Cloud mode active but DATABASE_URL is not set. Falling back gracefully.");
      return {
        recordings: [],
        total: 0,
        page: options?.page || 1,
        limit: options?.limit || 15,
        hasMore: false,
      };
    }
    return drizzleRecordingStore.getAllRecordings(options);
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    if (!process.env.DATABASE_URL) {
      return null;
    }
    const item = await drizzleRecordingStore.getRecordingById(id);
    if (!item) return null;

    // If audio is active and audioKey exists, ensure presigned R2 url is fresh
    if (item.audioStatus === "active" && item.audioFile) {
      try {
        const r2Url = await r2RecordingStore.getAudioUrl(item.id, item.audioFile);
        if (r2Url) {
          item.audioUrl = r2Url;
        }
      } catch {
        // Fallback to existing audioUrl
      }
    }
    return item;
  }

  async updateTranscription(id: string, newText: string, newTitle?: string): Promise<boolean> {
    return drizzleRecordingStore.updateTranscription(id, newText, newTitle);
  }

  async updateRecording(id: string, updates: { text?: string; title?: string }): Promise<boolean> {
    return drizzleRecordingStore.updateRecording(id, updates);
  }

  async deleteAudioOnly(id: string): Promise<boolean> {
    const detail = await drizzleRecordingStore.getRecordingById(id);
    if (detail?.audioFile) {
      try {
        await r2RecordingStore.deleteAudioFile(id, detail.audioFile);
      } catch (err) {
        console.warn("Could not delete audio file from R2:", err);
      }
    }
    return drizzleRecordingStore.deleteAudioOnly(id);
  }

  async resetToRawTranscript(id: string): Promise<boolean> {
    return drizzleRecordingStore.resetToRawTranscript(id);
  }

  async saveRecording(data: NewRecordingInput): Promise<boolean> {
    return drizzleRecordingStore.saveRecording(data);
  }

  async deleteRecording(id: string): Promise<boolean> {
    // Delete audio assets in R2
    try {
      await r2RecordingStore.deleteRecording(id);
    } catch (err) {
      console.warn("Failed to delete recording from R2:", err);
    }
    // Delete database record
    return drizzleRecordingStore.deleteRecording(id);
  }
}

export const cloudRecordingStore = new CloudRecordingStore();

export function getRecordingStore(): RecordingStore {
  if (isLocalMode()) {
    return fsRecordingStore;
  }
  return cloudRecordingStore;
}

export const recordingStore: RecordingStore = {
  getAllRecordings: (options) => getRecordingStore().getAllRecordings(options),
  getRecordingById: (id: string) => getRecordingStore().getRecordingById(id),
  updateTranscription: (id: string, newText: string, newTitle?: string) =>
    getRecordingStore().updateTranscription(id, newText, newTitle),
  updateRecording: (id: string, updates: { text?: string; title?: string }) => {
    const store = getRecordingStore();
    if (store.updateRecording) {
      return store.updateRecording(id, updates);
    }
    return store.updateTranscription(id, updates.text || "", updates.title);
  },
  deleteAudioOnly: (id: string) => {
    const store = getRecordingStore();
    if (store.deleteAudioOnly) {
      return store.deleteAudioOnly(id);
    }
    return cloudRecordingStore.deleteAudioOnly(id);
  },
  resetToRawTranscript: (id: string) => {
    const store = getRecordingStore();
    if (store.resetToRawTranscript) {
      return store.resetToRawTranscript(id);
    }
    return cloudRecordingStore.resetToRawTranscript(id);
  },
  saveRecording: (data: NewRecordingInput) => {
    const store = getRecordingStore();
    if (store.saveRecording) {
      return store.saveRecording(data);
    }
    return cloudRecordingStore.saveRecording(data);
  },
  deleteRecording: (id: string) => getRecordingStore().deleteRecording(id),
};
