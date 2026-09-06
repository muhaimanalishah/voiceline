import { pgSchema, text, integer, timestamp, vector, index } from "drizzle-orm/pg-core";

export const voicelineSchema = pgSchema("voiceline");

export const tags = voicelineSchema.table("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
});

export const recordings = voicelineSchema.table("recordings", {
  id: text("id").primaryKey(),
  tagId: text("tag_id").references(() => tags.id, { onDelete: "set null" }),
  title: text("title"),
  transcript: text("transcript"),
  rawTranscript: text("raw_transcript").notNull(),
  summary: text("summary"),
  embedding: vector("embedding", { dimensions: 1536}),
  modelUsed: text("model_used").notNull().default("gpt-4o-mini-transcribe"),
  duration: integer("duration"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
}, 
  (table) => [
    index("recordings_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
);

export const recordingChunks = voicelineSchema.table("recording_chunks", {
  id: text("id").primaryKey(),
  recordingId: text("recording_id")
    .notNull()
    .references(() => recordings.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("recording_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  index("recording_chunks_recording_id_idx").on(table.recordingId),
]);

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;

export type RecordingRow = typeof recordings.$inferSelect;
export type NewRecordingRow = typeof recordings.$inferInsert;

export type RecordingChunkRow = typeof recordingChunks.$inferSelect;
export type NewRecordingChunkRow = typeof recordingChunks.$inferInsert;
