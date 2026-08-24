import { eq, desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/db";
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

function getDatabase() {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured or PostgreSQL connection failed."
    );
  }
  return db;
}

export class DrizzleRecordingStore implements RecordingStore {
  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));
    const offset = (page - 1) * limit;

    const database = getDatabase();

    const countResult = await database
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.recordings);
    const total = countResult[0]?.total || 0;

    const rows = await database
      .select()
      .from(schema.recordings)
      .orderBy(desc(schema.recordings.createdAt))
      .limit(limit)
      .offset(offset);

    const items: RecordingItem[] = rows.map((row) => {
      const previewLength = 120;
      const text = row.transcript || "";
      const textPreview =
        text.length > previewLength
          ? text.slice(0, previewLength).trim() + "..."
          : text || "(No transcription)";

      return {
        id: row.id,
        tagId: row.tagId ?? null,
        title: row.title || row.id,
        createdAt: row.createdAt,
        textPreview,
        model: row.modelUsed,
        hasTranscript: Boolean(row.transcript),
        duration: row.duration ?? null,
      };
    });

    const hasMore = offset + limit < total;

    return {
      recordings: items,
      total,
      page,
      limit,
      hasMore,
    };
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    const database = getDatabase();
    const rows = await database
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, id))
      .limit(1);

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      id: row.id,
      tagId: row.tagId ?? null,
      title: row.title || row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      text: row.transcript,
      rawTranscript: row.rawTranscript,
      model: row.modelUsed,
      duration: row.duration ?? null,
    };
  }

  async updateTranscription(
    id: string,
    newText: string,
    newTitle?: string
  ): Promise<boolean> {
    return this.updateRecording(id, { text: newText, title: newTitle });
  }

  async updateRecording(
    id: string,
    updates: { text?: string; title?: string; tagId?: string | null }
  ): Promise<boolean> {
    const database = getDatabase();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.text !== undefined) {
      updateData.transcript = updates.text;
    }
    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }
    if (updates.tagId !== undefined) {
      updateData.tagId = updates.tagId;
    }

    await database
      .update(schema.recordings)
      .set(updateData)
      .where(eq(schema.recordings.id, id));

    return true;
  }

  async resetToRawTranscript(id: string): Promise<boolean> {
    const database = getDatabase();
    const existing = await database
      .select({ rawTranscript: schema.recordings.rawTranscript })
      .from(schema.recordings)
      .where(eq(schema.recordings.id, id))
      .limit(1);

    if (!existing || existing.length === 0) return false;

    const raw = existing[0].rawTranscript;
    await database
      .update(schema.recordings)
      .set({
        transcript: raw,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.recordings.id, id));

    return true;
  }

  async saveRecording(data: NewRecordingInput): Promise<boolean> {
    const database = getDatabase();
    await database
      .insert(schema.recordings)
      .values({
        id: data.id,
        tagId: data.tagId ?? null,
        title: data.title || data.id,
        transcript: data.transcript,
        rawTranscript: data.rawTranscript,
        modelUsed: data.modelUsed || "gpt-4o-mini-transcribe",
        duration: data.duration ?? null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.recordings.id,
        set: {
          transcript: data.transcript,
          title: data.title || data.id,
          tagId: data.tagId ?? null,
          updatedAt: new Date().toISOString(),
        },
      });

    return true;
  }

  async deleteRecording(id: string): Promise<boolean> {
    const database = getDatabase();
    await database
      .delete(schema.recordings)
      .where(eq(schema.recordings.id, id));

    return true;
  }

  // --- Tag Methods ---

  async getAllTags(): Promise<TagItem[]> {
    const database = getDatabase();
    return await database
      .select()
      .from(schema.tags)
      .orderBy(schema.tags.createdAt);
  }

  async createTag(data: NewTagInput): Promise<TagItem> {
    const database = getDatabase();
    const [created] = await database
      .insert(schema.tags)
      .values(data)
      .returning();
    return created;
  }

  async deleteTag(id: string): Promise<boolean> {
    const database = getDatabase();
    await database.delete(schema.tags).where(eq(schema.tags.id, id));
    return true;
  }
}

export const drizzleRecordingStore = new DrizzleRecordingStore();