import { eq, desc, sql, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/db";
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
import crypto from "crypto";

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
      const text = row.transcript || row.rawTranscript || "";
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
        summary: row.summary ? (() => { try { return JSON.parse(row.summary); } catch { return null; } })() : null,
        model: row.modelUsed,
        hasTranscript: Boolean(row.rawTranscript || row.transcript),
        isProcessed: Boolean(row.transcript),
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

  async getRecordingsByTag(
    tagId: string | null,
    options?: PaginationOptions
  ): Promise<PaginatedRecordings> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));
    const offset = (page - 1) * limit;

    const database = getDatabase();
    const tagFilter =
      tagId === null
        ? isNull(schema.recordings.tagId)
        : eq(schema.recordings.tagId, tagId);

    const countResult = await database
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.recordings)
      .where(tagFilter);
    const total = countResult[0]?.total || 0;

    const rows = await database
      .select()
      .from(schema.recordings)
      .where(tagFilter)
      .orderBy(desc(schema.recordings.createdAt))
      .limit(limit)
      .offset(offset);

    const items: RecordingItem[] = rows.map((row) => {
      const previewLength = 120;
      const text = row.transcript || row.rawTranscript || "";
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
        summary: row.summary ? (() => { try { return JSON.parse(row.summary); } catch { return null; } })() : null,
        model: row.modelUsed,
        hasTranscript: Boolean(row.rawTranscript || row.transcript),
        isProcessed: Boolean(row.transcript),
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
      text: row.transcript ?? null,
      rawTranscript: row.rawTranscript,
      summary: row.summary ? (() => { try { return JSON.parse(row.summary); } catch { return null; } })() : null,
      isProcessed: Boolean(row.transcript),
      model: row.modelUsed,
      duration: row.duration ?? null,
    };
  }

  async updateRecording(
    id: string,
    updates: {
      text?: string;
      title?: string;
      tagId?: string | null;
      summary?: string[] | null;
    }
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
    if (updates.summary !== undefined) {
      updateData.summary = updates.summary ? JSON.stringify(updates.summary) : null;
    }

    await database
      .update(schema.recordings)
      .set(updateData)
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
        summary: data.summary ? JSON.stringify(data.summary) : null,
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
          summary: data.summary ? JSON.stringify(data.summary) : null,
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

  async getAllTagsWithCounts(): Promise<TagWithCount[]> {
    const database = getDatabase();
    const rows = await database
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        description: schema.tags.description,
        color: schema.tags.color,
        createdAt: schema.tags.createdAt,
        updatedAt: schema.tags.updatedAt,
        recordingCount: sql<number>`count(${schema.recordings.id})::int`,
      })
      .from(schema.tags)
      .leftJoin(schema.recordings, eq(schema.recordings.tagId, schema.tags.id))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.createdAt);

    return rows;
  }

  async getUnclassifiedCount(): Promise<number> {
    const database = getDatabase();
    const countResult = await database
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.recordings)
      .where(isNull(schema.recordings.tagId));

    return countResult[0]?.total || 0;
  }

  async getTagById(id: string): Promise<TagItem | null> {
    const database = getDatabase();
    const rows = await database
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async createTag(data: NewTagInput): Promise<TagItem> {
    const database = getDatabase();
    const tagId = data.id || `tag-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const [created] = await database
      .insert(schema.tags)
      .values({
        id: tagId,
        name: data.name,
        description: data.description,
        color: data.color ?? null,
      })
      .returning();
    return created;
  }

  async updateTag(id: string, updates: UpdateTagInput): Promise<TagItem | null> {
    const database = getDatabase();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.color !== undefined) {
      updateData.color = updates.color;
    }

    const [updated] = await database
      .update(schema.tags)
      .set(updateData)
      .where(eq(schema.tags.id, id))
      .returning();

    return updated || null;
  }

  async deleteTag(id: string): Promise<boolean> {
    const database = getDatabase();
    const deleted = await database
      .delete(schema.tags)
      .where(eq(schema.tags.id, id))
      .returning({ id: schema.tags.id });

    return deleted.length > 0;
  }
}

export const drizzleRecordingStore = new DrizzleRecordingStore();