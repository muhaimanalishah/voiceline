import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
  TagItem,
  TagWithCount,
  NewTagInput,
  UpdateTagInput,
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
  TagWithCount,
  NewTagInput,
  UpdateTagInput,
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

export const recordingStore: RecordingStore = drizzleRecordingStore;

