import { eq, desc, sql, isNull, isNotNull, cosineDistance } from "drizzle-orm";
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
  UpdateRecordingInput,
  HybridSearchResult,
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
    updates: UpdateRecordingInput
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
    if (updates.embedding !== undefined) {
      updateData.embedding = updates.embedding;
    }

    await database
      .update(schema.recordings)
      .set(updateData)
      .where(eq(schema.recordings.id, id));

    // Persist granular chunks if provided
    if (updates.chunks && updates.chunks.length > 0) {
      await database
        .delete(schema.recordingChunks)
        .where(eq(schema.recordingChunks.recordingId, id));

      await database.insert(schema.recordingChunks).values(
        updates.chunks.map((chunk) => ({
          id: `${id}_chunk_${chunk.chunkIndex}`,
          recordingId: id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
        }))
      );
    }

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
        embedding: data.embedding ?? null,
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
          embedding: data.embedding ?? null,
          updatedAt: new Date().toISOString(),
        },
      });

    // Persist granular chunks if provided
    if (data.chunks && data.chunks.length > 0) {
      await database
        .delete(schema.recordingChunks)
        .where(eq(schema.recordingChunks.recordingId, data.id));

      await database.insert(schema.recordingChunks).values(
        data.chunks.map((chunk) => ({
          id: `${data.id}_chunk_${chunk.chunkIndex}`,
          recordingId: data.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
        }))
      );
    }

    return true;
  }

  async hybridSearchNotes({
    queryText,
    queryEmbedding,
    limit = 5,
  }: {
    queryText: string;
    queryEmbedding?: number[];
    limit?: number;
  }): Promise<HybridSearchResult[]> {
    const database = getDatabase();
    const candidateLimit = Math.max(limit * 3, 15);

    type RankedCandidate = {
      id: string;
      title: string | null;
      tagName: string | null;
      createdAt: string;
      chunkContent: string;
      chunkIndex: number;
      denseRank?: number;
      sparseRank?: number;
      denseScore?: number;
      sparseScore?: number;
    };

    const candidatesMap = new Map<string, RankedCandidate>();

    // 1. DENSE VECTOR SEARCH (on recording_chunks)
    if (queryEmbedding && queryEmbedding.length > 0) {
      try {
        const similarity = sql<number>`1 - (${cosineDistance(
          schema.recordingChunks.embedding,
          queryEmbedding
        )})`;

        const chunkRows = await database
          .select({
            id: schema.recordings.id,
            title: schema.recordings.title,
            tagName: schema.tags.name,
            createdAt: schema.recordings.createdAt,
            chunkContent: schema.recordingChunks.content,
            chunkIndex: schema.recordingChunks.chunkIndex,
            similarity,
          })
          .from(schema.recordingChunks)
          .innerJoin(
            schema.recordings,
            eq(schema.recordingChunks.recordingId, schema.recordings.id)
          )
          .leftJoin(schema.tags, eq(schema.recordings.tagId, schema.tags.id))
          .where(isNotNull(schema.recordingChunks.embedding))
          .orderBy(desc(similarity))
          .limit(candidateLimit);

        chunkRows.forEach((row, rank) => {
          const key = `${row.id}_${row.chunkIndex}`;
          candidatesMap.set(key, {
            id: row.id,
            title: row.title,
            tagName: row.tagName,
            createdAt: row.createdAt,
            chunkContent: row.chunkContent,
            chunkIndex: row.chunkIndex,
            denseRank: rank + 1,
            denseScore: row.similarity,
          });
        });

        // Also check recordings without chunks (fallback for whole-note embeddings)
        const noteSimilarity = sql<number>`1 - (${cosineDistance(
          schema.recordings.embedding,
          queryEmbedding
        )})`;

        const noteRows = await database
          .select({
            id: schema.recordings.id,
            title: schema.recordings.title,
            tagName: schema.tags.name,
            createdAt: schema.recordings.createdAt,
            content: sql<string>`coalesce(${schema.recordings.transcript}, ${schema.recordings.rawTranscript})`,
            similarity: noteSimilarity,
          })
          .from(schema.recordings)
          .leftJoin(schema.tags, eq(schema.recordings.tagId, schema.tags.id))
          .where(isNotNull(schema.recordings.embedding))
          .orderBy(desc(noteSimilarity))
          .limit(5);

        noteRows.forEach((row, rank) => {
          const key = `${row.id}_0`;
          if (!candidatesMap.has(key)) {
            candidatesMap.set(key, {
              id: row.id,
              title: row.title,
              tagName: row.tagName,
              createdAt: row.createdAt,
              chunkContent: row.content,
              chunkIndex: 0,
              denseRank: rank + 1,
              denseScore: row.similarity,
            });
          }
        });
      } catch (err) {
        console.error("Vector search failed:", err);
      }
    }

    // 2. SPARSE / FULL-TEXT KEYWORD SEARCH
    if (queryText.trim()) {
      try {
        const textRank = sql<number>`ts_rank_cd(
          to_tsvector('english', coalesce(${schema.recordingChunks.content}, '')),
          plainto_tsquery('english', ${queryText})
        )`;

        const textMatches = await database
          .select({
            id: schema.recordings.id,
            title: schema.recordings.title,
            tagName: schema.tags.name,
            createdAt: schema.recordings.createdAt,
            chunkContent: schema.recordingChunks.content,
            chunkIndex: schema.recordingChunks.chunkIndex,
            rankScore: textRank,
          })
          .from(schema.recordingChunks)
          .innerJoin(
            schema.recordings,
            eq(schema.recordingChunks.recordingId, schema.recordings.id)
          )
          .leftJoin(schema.tags, eq(schema.recordings.tagId, schema.tags.id))
          .where(
            sql`to_tsvector('english', coalesce(${schema.recordingChunks.content}, '')) @@ plainto_tsquery('english', ${queryText})`
          )
          .orderBy(desc(textRank))
          .limit(candidateLimit);

        textMatches.forEach((row, rank) => {
          const key = `${row.id}_${row.chunkIndex}`;
          const existing = candidatesMap.get(key);
          if (existing) {
            existing.sparseRank = rank + 1;
            existing.sparseScore = row.rankScore;
          } else {
            candidatesMap.set(key, {
              id: row.id,
              title: row.title,
              tagName: row.tagName,
              createdAt: row.createdAt,
              chunkContent: row.chunkContent,
              chunkIndex: row.chunkIndex,
              sparseRank: rank + 1,
              sparseScore: row.rankScore,
            });
          }
        });
      } catch (err) {
        console.error("Text search failed:", err);
      }
    }

    // 3. RECIPROCAL RANK FUSION (RRF)
    const k = 60; // standard RRF smoothing constant
    const denseWeight = 0.65;
    const sparseWeight = 0.35;

    const scoredResults: HybridSearchResult[] = Array.from(
      candidatesMap.values()
    ).map((candidate) => {
      let rrfScore = 0;
      let matchType: "hybrid" | "vector" | "keyword" = "vector";

      if (candidate.denseRank !== undefined && candidate.sparseRank !== undefined) {
        rrfScore =
          denseWeight / (k + candidate.denseRank) +
          sparseWeight / (k + candidate.sparseRank);
        matchType = "hybrid";
      } else if (candidate.denseRank !== undefined) {
        rrfScore = denseWeight / (k + candidate.denseRank);
        matchType = "vector";
      } else if (candidate.sparseRank !== undefined) {
        rrfScore = sparseWeight / (k + candidate.sparseRank);
        matchType = "keyword";
      }

      return {
        id: candidate.id,
        title: candidate.title,
        tagName: candidate.tagName,
        createdAt: candidate.createdAt,
        chunkContent: candidate.chunkContent,
        chunkIndex: candidate.chunkIndex,
        score: rrfScore,
        matchType,
      };
    });

    // Sort by RRF score descending
    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.slice(0, limit);
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