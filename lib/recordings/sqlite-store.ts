import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq, desc, isNull, sql } from "drizzle-orm";
import * as schema from "@/lib/db/sqlite-schema";
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
import { DEMO_TAGS, prepareSeededRecordings } from "@/lib/db/demo-seeds";
import path from "path";
import crypto from "crypto";

declare global {
  var _sqliteDbInstance: BetterSQLite3Database<typeof schema> | undefined;
  var _sqliteRawDb: Database.Database | undefined;
}

function getSqliteDb() {
  if (global._sqliteDbInstance) {
    return global._sqliteDbInstance;
  }

  const dbPath = path.resolve(process.cwd(), "voiceline-demo.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Create tables if they do not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
      title TEXT,
      transcript TEXT,
      raw_transcript TEXT NOT NULL,
      summary TEXT,
      embedding TEXT,
      model_used TEXT NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
      duration INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recording_chunks (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema });
  global._sqliteRawDb = sqlite;
  global._sqliteDbInstance = db;

  return db;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SqliteRecordingStore implements RecordingStore {
  private db: BetterSQLite3Database<typeof schema>;
  private hasInitialized = false;

  constructor() {
    this.db = getSqliteDb();
  }

  private async ensureInitialized() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;
    const tagCount = this.db.select({ count: sql<number>`count(*)` }).from(schema.tags).get()?.count || 0;
    if (tagCount === 0) {
      await this.seedDemoData();
    }
  }

  async seedDemoData(force = false) {
    if (force) {
      this.db.delete(schema.recordingChunks).run();
      this.db.delete(schema.recordings).run();
      this.db.delete(schema.tags).run();
    }

    // 1. Seed Tags
    for (const tag of DEMO_TAGS) {
      this.db
        .insert(schema.tags)
        .values({
          id: tag.id,
          name: tag.name,
          description: tag.description,
          color: tag.color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }

    // 2. Seed Notes with precomputed embeddings & chunks
    const preparedNotes = await prepareSeededRecordings();
    for (const note of preparedNotes) {
      this.db
        .insert(schema.recordings)
        .values({
          id: note.id,
          tagId: note.tagId,
          title: note.title,
          transcript: note.transcript,
          rawTranscript: note.rawTranscript,
          summary: note.summary ? JSON.stringify(note.summary) : null,
          embedding: note.embedding ? JSON.stringify(note.embedding) : null,
          modelUsed: "gpt-4o-mini-transcribe",
          duration: note.duration,
          createdAt: note.createdAt,
          updatedAt: note.createdAt,
        })
        .onConflictDoNothing()
        .run();

      if (note.chunks && note.chunks.length > 0) {
        for (const chunk of note.chunks) {
          this.db
            .insert(schema.recordingChunks)
            .values({
              id: `${note.id}-chunk-${chunk.chunkIndex}`,
              recordingId: note.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
              createdAt: note.createdAt,
            })
            .onConflictDoNothing()
            .run();
        }
      }
    }
  }

  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    await this.ensureInitialized();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));
    const offset = (page - 1) * limit;

    const countResult = this.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.recordings)
      .get();
    const total = countResult?.total || 0;

    const rows = this.db
      .select()
      .from(schema.recordings)
      .orderBy(desc(schema.recordings.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

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
        summary: row.summary
          ? (() => {
              try {
                return JSON.parse(row.summary);
              } catch {
                return null;
              }
            })()
          : null,
        model: row.modelUsed,
        hasTranscript: Boolean(row.rawTranscript || row.transcript),
        isProcessed: Boolean(row.transcript),
        duration: row.duration ?? null,
      };
    });

    return {
      recordings: items,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async getRecordingsByTag(
    tagId: string | null,
    options?: PaginationOptions
  ): Promise<PaginatedRecordings> {
    await this.ensureInitialized();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));
    const offset = (page - 1) * limit;

    const tagFilter =
      tagId === null
        ? isNull(schema.recordings.tagId)
        : eq(schema.recordings.tagId, tagId);

    const countResult = this.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.recordings)
      .where(tagFilter)
      .get();
    const total = countResult?.total || 0;

    const rows = this.db
      .select()
      .from(schema.recordings)
      .where(tagFilter)
      .orderBy(desc(schema.recordings.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

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
        summary: row.summary
          ? (() => {
              try {
                return JSON.parse(row.summary);
              } catch {
                return null;
              }
            })()
          : null,
        model: row.modelUsed,
        hasTranscript: Boolean(row.rawTranscript || row.transcript),
        isProcessed: Boolean(row.transcript),
        duration: row.duration ?? null,
      };
    });

    return {
      recordings: items,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    await this.ensureInitialized();
    const rows = this.db
      .select({
        recording: schema.recordings,
        tagName: schema.tags.name,
      })
      .from(schema.recordings)
      .leftJoin(schema.tags, eq(schema.recordings.tagId, schema.tags.id))
      .where(eq(schema.recordings.id, id))
      .all();

    if (rows.length === 0) return null;
    const { recording: row } = rows[0];

    return {
      id: row.id,
      title: row.title || row.id,
      text: row.transcript ?? null,
      rawTranscript: row.rawTranscript,
      summary: row.summary
        ? (() => {
            try {
              return JSON.parse(row.summary);
            } catch {
              return null;
            }
          })()
        : null,
      tagId: row.tagId ?? null,
      model: row.modelUsed,
      duration: row.duration ?? null,
      isProcessed: Boolean(row.transcript),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async saveRecording(data: NewRecordingInput): Promise<boolean> {
    await this.ensureInitialized();
    const now = data.createdAt || new Date().toISOString();
    this.db
      .insert(schema.recordings)
      .values({
        id: data.id,
        tagId: data.tagId ?? null,
        title: data.title ?? null,
        transcript: data.transcript ?? null,
        rawTranscript: data.rawTranscript,
        summary: data.summary ? JSON.stringify(data.summary) : null,
        embedding: data.embedding ? JSON.stringify(data.embedding) : null,
        modelUsed: data.modelUsed || "gpt-4o-mini-transcribe",
        duration: data.duration ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (data.chunks && data.chunks.length > 0) {
      for (const chunk of data.chunks) {
        this.db
          .insert(schema.recordingChunks)
          .values({
            id: `${data.id}-chunk-${chunk.chunkIndex}`,
            recordingId: data.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
            createdAt: now,
          })
          .run();
      }
    }

    return true;
  }

  async updateRecording(
    id: string,
    updates: UpdateRecordingInput
  ): Promise<boolean> {
    await this.ensureInitialized();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.text !== undefined) updateData.transcript = updates.text;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.tagId !== undefined) updateData.tagId = updates.tagId;
    if (updates.summary !== undefined)
      updateData.summary = updates.summary ? JSON.stringify(updates.summary) : null;
    if (updates.embedding !== undefined)
      updateData.embedding = updates.embedding ? JSON.stringify(updates.embedding) : null;

    this.db
      .update(schema.recordings)
      .set(updateData)
      .where(eq(schema.recordings.id, id))
      .run();

    if (updates.chunks && updates.chunks.length > 0) {
      this.db
        .delete(schema.recordingChunks)
        .where(eq(schema.recordingChunks.recordingId, id))
        .run();

      for (const chunk of updates.chunks) {
        this.db
          .insert(schema.recordingChunks)
          .values({
            id: `${id}-chunk-${chunk.chunkIndex}`,
            recordingId: id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    }

    return true;
  }

  async deleteRecording(id: string): Promise<boolean> {
    await this.ensureInitialized();
    this.db.delete(schema.recordings).where(eq(schema.recordings.id, id)).run();
    return true;
  }

  async hybridSearchNotes(params: {
    queryText: string;
    queryEmbedding?: number[];
    limit?: number;
  }): Promise<HybridSearchResult[]> {
    await this.ensureInitialized();
    const { queryText, queryEmbedding, limit = 5 } = params;
    const queryTokens = queryText.toLowerCase().split(/\s+/).filter(Boolean);

    // Retrieve all chunks joined with recordings and tags
    const chunkRows = this.db
      .select({
        chunkId: schema.recordingChunks.id,
        recordingId: schema.recordings.id,
        title: schema.recordings.title,
        tagName: schema.tags.name,
        createdAt: schema.recordings.createdAt,
        content: schema.recordingChunks.content,
        chunkIndex: schema.recordingChunks.chunkIndex,
        embeddingJson: schema.recordingChunks.embedding,
      })
      .from(schema.recordingChunks)
      .innerJoin(schema.recordings, eq(schema.recordingChunks.recordingId, schema.recordings.id))
      .leftJoin(schema.tags, eq(schema.recordings.tagId, schema.tags.id))
      .all();

    type Candidate = {
      id: string;
      title: string | null;
      tagName: string | null;
      createdAt: string;
      chunkContent: string;
      chunkIndex: number;
      denseScore?: number;
      denseRank?: number;
      sparseScore?: number;
      sparseRank?: number;
    };

    const candidatesMap = new Map<string, Candidate>();

    // 1. Vector Dense Scoring
    if (queryEmbedding && queryEmbedding.length > 0) {
      const denseScored = chunkRows
        .map((row) => {
          let emb: number[] | null = null;
          if (row.embeddingJson) {
            try {
              emb = JSON.parse(row.embeddingJson);
            } catch {
              emb = null;
            }
          }
          const similarity = emb ? cosineSimilarity(queryEmbedding, emb) : 0;
          return { row, similarity };
        })
        .filter((item) => item.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity);

      denseScored.forEach((item, index) => {
        const key = `${item.row.recordingId}_${item.row.chunkIndex}`;
        candidatesMap.set(key, {
          id: item.row.recordingId,
          title: item.row.title,
          tagName: item.row.tagName ?? null,
          createdAt: item.row.createdAt,
          chunkContent: item.row.content,
          chunkIndex: item.row.chunkIndex,
          denseScore: item.similarity,
          denseRank: index + 1,
        });
      });
    }

    // 2. Keyword Sparse Scoring
    if (queryTokens.length > 0) {
      const sparseScored = chunkRows
        .map((row) => {
          const text = `${row.title || ""} ${row.tagName || ""} ${row.content}`.toLowerCase();
          let matchCount = 0;
          for (const token of queryTokens) {
            if (text.includes(token)) {
              matchCount += (text.split(token).length - 1);
            }
          }
          return { row, matchCount };
        })
        .filter((item) => item.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);

      sparseScored.forEach((item, index) => {
        const key = `${item.row.recordingId}_${item.row.chunkIndex}`;
        const existing = candidatesMap.get(key);
        if (existing) {
          existing.sparseScore = item.matchCount;
          existing.sparseRank = index + 1;
        } else {
          candidatesMap.set(key, {
            id: item.row.recordingId,
            title: item.row.title,
            tagName: item.row.tagName ?? null,
            createdAt: item.row.createdAt,
            chunkContent: item.row.content,
            chunkIndex: item.row.chunkIndex,
            sparseScore: item.matchCount,
            sparseRank: index + 1,
          });
        }
      });
    }

    // 3. Reciprocal Rank Fusion (RRF)
    const k = 60;
    const denseWeight = 0.65;
    const sparseWeight = 0.35;

    const scoredResults: HybridSearchResult[] = Array.from(candidatesMap.values()).map((cand) => {
      let rrfScore = 0;
      let matchType: "hybrid" | "vector" | "keyword" = "vector";

      if (cand.denseRank !== undefined && cand.sparseRank !== undefined) {
        rrfScore = denseWeight / (k + cand.denseRank) + sparseWeight / (k + cand.sparseRank);
        matchType = "hybrid";
      } else if (cand.denseRank !== undefined) {
        rrfScore = denseWeight / (k + cand.denseRank);
        matchType = "vector";
      } else if (cand.sparseRank !== undefined) {
        rrfScore = sparseWeight / (k + cand.sparseRank);
        matchType = "keyword";
      }

      return {
        id: cand.id,
        title: cand.title,
        tagName: cand.tagName,
        createdAt: cand.createdAt,
        chunkContent: cand.chunkContent,
        chunkIndex: cand.chunkIndex,
        score: rrfScore,
        matchType,
      };
    });

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  }

  // --- Tag Methods ---

  async getAllTags(): Promise<TagItem[]> {
    await this.ensureInitialized();
    return this.db.select().from(schema.tags).orderBy(schema.tags.createdAt).all();
  }

  async getAllTagsWithCounts(): Promise<TagWithCount[]> {
    await this.ensureInitialized();
    const rows = this.db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        description: schema.tags.description,
        color: schema.tags.color,
        createdAt: schema.tags.createdAt,
        updatedAt: schema.tags.updatedAt,
        recordingCount: sql<number>`count(${schema.recordings.id})`,
      })
      .from(schema.tags)
      .leftJoin(schema.recordings, eq(schema.recordings.tagId, schema.tags.id))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.createdAt)
      .all();

    return rows;
  }

  async getUnclassifiedCount(): Promise<number> {
    await this.ensureInitialized();
    const countResult = this.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.recordings)
      .where(isNull(schema.recordings.tagId))
      .get();

    return countResult?.total || 0;
  }

  async getTagById(id: string): Promise<TagItem | null> {
    await this.ensureInitialized();
    const rows = this.db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1).all();
    return rows[0] || null;
  }

  async createTag(data: NewTagInput): Promise<TagItem> {
    await this.ensureInitialized();
    const tagId = data.id || `tag-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const [created] = this.db
      .insert(schema.tags)
      .values({
        id: tagId,
        name: data.name,
        description: data.description,
        color: data.color ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();

    return created;
  }

  async updateTag(id: string, updates: UpdateTagInput): Promise<TagItem | null> {
    await this.ensureInitialized();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.color !== undefined) updateData.color = updates.color;

    this.db.update(schema.tags).set(updateData).where(eq(schema.tags.id, id)).run();
    return await this.getTagById(id);
  }

  async deleteTag(id: string): Promise<boolean> {
    await this.ensureInitialized();
    this.db.delete(schema.tags).where(eq(schema.tags.id, id)).run();
    return true;
  }
}

export const sqliteRecordingStore = new SqliteRecordingStore();
