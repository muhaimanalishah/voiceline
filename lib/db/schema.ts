import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const recordings = pgTable("recordings", {
  id: text("id").primaryKey(),
  title: text("title"),
  transcript: text("transcript").notNull(),
  rawTranscript: text("raw_transcript").notNull(),
  modelUsed: text("model_used").notNull().default("gpt-4o-mini-transcribe"),
  duration: integer("duration"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
});

export type RecordingRow = typeof recordings.$inferSelect;
export type NewRecordingRow = typeof recordings.$inferInsert;

