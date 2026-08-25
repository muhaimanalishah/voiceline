import { pgTable, text, integer, timestamp, vector, index } from "drizzle-orm/pg-core";

export const tags = pgTable("tags", {
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

export const recordings = pgTable("recordings", {
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

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;

export type RecordingRow = typeof recordings.$inferSelect;
export type NewRecordingRow = typeof recordings.$inferInsert;
