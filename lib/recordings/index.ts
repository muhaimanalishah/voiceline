import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TranscriptionJsonData,
} from "./types";
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

export { drizzleRecordingStore, r2RecordingStore };

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

export function assertValidEnv(): void {
  const validation = validateCloudEnv();
  if (!validation.valid) {
    throw new Error(
      `Cloud backend configuration missing: ${validation.missing.join(", ")}.`
    );
  }
}

/**
 * CloudRecordingStore combines PostgreSQL (via Drizzle ORM) for note & transcript metadata
 * and Cloudflare R2 (via S3 SDK) for audio storage.
 */
export class CloudRecordingStore implements RecordingStore {
  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    assertValidEnv();
    const result = await drizzleRecordingStore.getAllRecordings(options);

    // Populate presigned/direct R2 URLs for active audio files
    const recordingsWithUrls = await Promise.all(
      result.recordings.map(async (item) => {
        if (item.audioStatus === "active" && item.audioFile) {
          try {
            const r2Url = await r2RecordingStore.getAudioUrl(item.id, item.audioFile);
            if (r2Url) {
              return { ...item, audioUrl: r2Url };
            }
          } catch {
            // Keep existing audioUrl
          }
        }
        return item;
      })
    );

    return {
      ...result,
      recordings: recordingsWithUrls,
    };
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    assertValidEnv();
    const item = await drizzleRecordingStore.getRecordingById(id);
    if (!item) return null;

    // If audio is active and audioFile exists, ensure presigned R2 url is fresh
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
    assertValidEnv();
    return drizzleRecordingStore.updateTranscription(id, newText, newTitle);
  }

  async updateRecording(id: string, updates: { text?: string; title?: string }): Promise<boolean> {
    assertValidEnv();
    return drizzleRecordingStore.updateRecording(id, updates);
  }

  async deleteAudioOnly(id: string): Promise<boolean> {
    assertValidEnv();
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
    assertValidEnv();
    return drizzleRecordingStore.resetToRawTranscript(id);
  }

  async saveRecording(data: NewRecordingInput): Promise<boolean> {
    assertValidEnv();
    return drizzleRecordingStore.saveRecording(data);
  }

  async deleteRecording(id: string): Promise<boolean> {
    assertValidEnv();
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
  return cloudRecordingStore;
}

export const recordingStore: RecordingStore = cloudRecordingStore;
