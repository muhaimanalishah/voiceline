import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TagItem,
  NewTagInput,
} from "./types";
import { drizzleRecordingStore } from "./drizzle-store";

export type {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TagItem,
  NewTagInput,
};


export { drizzleRecordingStore };

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

export function validateDatabaseEnv(): EnvValidationResult {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function assertValidEnv(): void {
  const validation = validateDatabaseEnv();
  if (!validation.valid) {
    throw new Error(
      `Database backend configuration missing: ${validation.missing.join(", ")}.`
    );
  }
}

export const recordingStore: RecordingStore = drizzleRecordingStore;
export const getRecordingStore = (): RecordingStore => drizzleRecordingStore;

