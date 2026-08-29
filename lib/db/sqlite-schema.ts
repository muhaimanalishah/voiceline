import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const recordings = sqliteTable(
  "recordings",
  {
    id: text("id").primaryKey(),
    tagId: text("tag_id").references(() => tags.id, { onDelete: "set null" }),
    title: text("title"),
    transcript: text("transcript"),
    rawTranscript: text("raw_transcript").notNull(),
    summary: text("summary"),
    // In SQLite, store serialized JSON array of floats for cosine similarity
    embedding: text("embedding"),
    modelUsed: text("model_used").notNull().default("gpt-4o-mini-transcribe"),
    duration: integer("duration"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("sqlite_recordings_tag_id_idx").on(table.tagId),
    index("sqlite_recordings_created_at_idx").on(table.createdAt),
  ]
);

export const recordingChunks = sqliteTable(
  "recording_chunks",
  {
    id: text("id").primaryKey(),
    recordingId: text("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // In SQLite, store serialized JSON array of floats
    embedding: text("embedding"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("sqlite_recording_chunks_recording_id_idx").on(table.recordingId),
  ]
);

export type SqliteTagRow = typeof tags.$inferSelect;
export type NewSqliteTagRow = typeof tags.$inferInsert;

export type SqliteRecordingRow = typeof recordings.$inferSelect;
export type NewSqliteRecordingRow = typeof recordings.$inferInsert;

export type SqliteRecordingChunkRow = typeof recordingChunks.$inferSelect;
export type NewSqliteRecordingChunkRow = typeof recordingChunks.$inferInsert;
