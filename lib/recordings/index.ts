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
import { sqliteRecordingStore } from "./sqlite-store";
import { isDemoMode } from "@/lib/db/db";

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

export { drizzleRecordingStore, sqliteRecordingStore, isDemoMode };

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

export function validateDatabaseEnv(): EnvValidationResult {
  if (isDemoMode) {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");

  return {
    valid: missing.length === 0,
    missing,
  };
}

export const recordingStore: RecordingStore = isDemoMode
  ? sqliteRecordingStore
  : drizzleRecordingStore;

