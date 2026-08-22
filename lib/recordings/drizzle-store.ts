import { eq, desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/db";
import { promises as fs } from "fs";
import path from "path";
import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  PaginationOptions,
  PaginatedRecordings,
  NewRecordingInput,
} from "./types";
import { fsRecordingStore } from "./fs-store";

export class DrizzleRecordingStore implements RecordingStore {
  private getDb() {
    if (!db) {
      throw new Error(
        "DATABASE_URL is not configured or PostgreSQL connection failed."
      );
    }
    return db;
  }

  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));
    const offset = (page - 1) * limit;

    try {
      const database = this.getDb();

      // Count total recordings
      const countResult = await database
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.recordings);
      const total = countResult[0]?.total || 0;

      // Select paginated items ordered newest first
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
          title: row.title || row.id,
          createdAt: row.createdAt,
          textPreview,
          model: row.modelUsed,
          audioFile: row.audioFile || "audio.webm",
          audioUrl: row.audioUrl || `/uploads/${row.id}/${row.audioFile || "audio.webm"}`,
          audioStatus: (row.audioStatus as "active" | "deleted") || "active",
          audioKey: row.audioKey || undefined,
          hasTranscript: Boolean(row.transcript),
          size: row.size || 0,
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
    } catch (error) {
      console.warn("Drizzle database not reachable, falling back to FS:", error);
      return fsRecordingStore.getAllRecordings(options);
    }
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    try {
      const database = this.getDb();
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
        title: row.title || row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        text: row.transcript,
        rawTranscript: row.rawTranscript,
        model: row.modelUsed,
        audioFile: row.audioFile || "audio.webm",
        audioUrl: row.audioUrl || `/uploads/${row.id}/${row.audioFile || "audio.webm"}`,
        audioStatus: (row.audioStatus as "active" | "deleted") || "active",
        audioKey: row.audioKey || undefined,
        duration: row.duration ?? null,
        size: row.size || 0,
        transcriptionJsonUrl: `/uploads/${row.id}/transcription.json`,
      };
    } catch (error) {
      console.warn("Drizzle database error in getRecordingById, falling back to FS:", error);
      return fsRecordingStore.getRecordingById(id);
    }
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
    updates: { text?: string; title?: string }
  ): Promise<boolean> {
    try {
      const database = this.getDb();
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (updates.text !== undefined) {
        updateData.transcript = updates.text;
      }
      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }

      await database
        .update(schema.recordings)
        .set(updateData)
        .where(eq(schema.recordings.id, id));

      // Also keep local filesystem in sync if folder exists
      fsRecordingStore.updateRecording(id, updates).catch(() => {});

      return true;
    } catch (error) {
      console.error("Drizzle updateRecording error:", error);
      return fsRecordingStore.updateRecording(id, updates);
    }
  }

  async deleteAudioOnly(id: string): Promise<boolean> {
    try {
      const database = this.getDb();
      await database
        .update(schema.recordings)
        .set({
          audioStatus: "deleted",
          audioUrl: "",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.recordings.id, id));

      // Delete physical audio file from local disk to reclaim space
      const folderPath = path.join(process.cwd(), "public", "uploads", path.basename(id));
      try {
        const files = await fs.readdir(folderPath);
        for (const file of files) {
          if (file !== "transcription.json") {
            await fs.unlink(path.join(folderPath, file)).catch(() => {});
          }
        }
      } catch {
        // Ignore file removal errors
      }

      return true;
    } catch (error) {
      console.error("Drizzle deleteAudioOnly error:", error);
      return false;
    }
  }

  async resetToRawTranscript(id: string): Promise<boolean> {
    try {
      const database = this.getDb();
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

      fsRecordingStore.updateRecording(id, { text: raw }).catch(() => {});

      return true;
    } catch (error) {
      console.error("Drizzle resetToRawTranscript error:", error);
      return false;
    }
  }

  async saveRecording(data: NewRecordingInput): Promise<boolean> {
    try {
      const database = this.getDb();
      await database
        .insert(schema.recordings)
        .values({
          id: data.id,
          title: data.title || data.id,
          transcript: data.transcript,
          rawTranscript: data.rawTranscript,
          modelUsed: data.modelUsed || "gpt-4o-mini-transcribe",
          audioKey: data.audioKey || `recordings/${data.id}/${data.audioFile || "audio.webm"}`,
          audioStatus: data.audioStatus || "active",
          audioUrl: data.audioUrl || `/uploads/${data.id}/${data.audioFile || "audio.webm"}`,
          audioFile: data.audioFile || "audio.webm",
          duration: data.duration ?? null,
          size: data.size || 0,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.recordings.id,
          set: {
            transcript: data.transcript,
            title: data.title || data.id,
            updatedAt: new Date().toISOString(),
          },
        });

      return true;
    } catch (error) {
      console.error("Drizzle saveRecording error:", error);
      return false;
    }
  }

  async deleteRecording(id: string): Promise<boolean> {
    try {
      const database = this.getDb();
      await database
        .delete(schema.recordings)
        .where(eq(schema.recordings.id, id));

      // Remove from filesystem
      await fsRecordingStore.deleteRecording(id);

      return true;
    } catch (error) {
      console.error("Drizzle deleteRecording error:", error);
      return fsRecordingStore.deleteRecording(id);
    }
  }
}

export const drizzleRecordingStore = new DrizzleRecordingStore();
