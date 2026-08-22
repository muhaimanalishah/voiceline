import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  TranscriptionJsonData,
  PaginationOptions,
  PaginatedRecordings,
} from "./types";

export class FsRecordingStore implements RecordingStore {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir =
      uploadsDir || path.join(process.cwd(), "public", "uploads");
  }

  private sanitizeId(id: string): string {
    return path.basename(id);
  }

  private async ensureUploadsDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch {
      // Directory exists or couldn't be created
    }
  }

  private generateDefaultTitle(createdAt: string): string {
    try {
      const date = new Date(createdAt);
      return `Voice Note - ${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } catch {
      return "Voice Note";
    }
  }

  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    await this.ensureUploadsDir();

    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));

    try {
      const entries = await fs.readdir(this.uploadsDir, {
        withFileTypes: true,
      });
      const folderEntries = entries.filter((entry) => entry.isDirectory());

      const items: RecordingItem[] = [];

      for (const folder of folderEntries) {
        const folderName = folder.name;
        const folderPath = path.join(this.uploadsDir, folderName);
        const jsonPath = path.join(folderPath, "transcription.json");

        let text = "";
        let title: string | undefined = undefined;
        let model = "gpt-4o-mini-transcribe";
        let createdAt = new Date().toISOString();
        let audioFile = "audio.webm";
        let duration: number | null = null;
        let hasTranscript = false;

        // Try reading transcription.json
        if (fsSync.existsSync(jsonPath)) {
          try {
            const rawJson = await fs.readFile(jsonPath, "utf-8");
            const data: TranscriptionJsonData = JSON.parse(rawJson);
            text = data.text || "";
            title = data.title;
            model = data.model || model;
            createdAt = data.createdAt || createdAt;
            audioFile = data.audioFile || audioFile;
            duration = data.duration ?? null;
            hasTranscript = true;
          } catch (e) {
            console.error(`Error reading ${jsonPath}:`, e);
          }
        } else {
          // Parse timestamp from folder name if available (recording-<timestamp>-<id>)
          const match = folderName.match(/^recording-(\d+)/);
          if (match && match[1]) {
            createdAt = new Date(parseInt(match[1], 10)).toISOString();
          }

          // Check if audio file exists in folder
          try {
            const folderFiles = await fs.readdir(folderPath);
            const foundAudio = folderFiles.find(
              (f) =>
                f.startsWith("audio.") ||
                f.endsWith(".webm") ||
                f.endsWith(".mp4") ||
                f.endsWith(".wav") ||
                f.endsWith(".ogg") ||
                f.endsWith(".mp3") ||
                f.endsWith(".m4a") ||
                f.endsWith(".aac")
            );
            if (foundAudio) {
              audioFile = foundAudio;
            }
          } catch {
            // Ignore error
          }
        }

        // Get file size if audio file exists
        let size = 0;
        const audioPath = path.join(/*turbopackIgnore: true*/ folderPath, audioFile);
        if (fsSync.existsSync(/*turbopackIgnore: true*/ audioPath)) {
          try {
            const stat = await fs.stat(/*turbopackIgnore: true*/ audioPath);
            size = stat.size;
          } catch {
            // Ignore stat error
          }
        }

        const previewLength = 120;
        const textPreview =
          text.length > previewLength
            ? text.slice(0, previewLength).trim() + "..."
            : text || "(No transcription yet)";

        items.push({
          id: folderName,
          title: title || this.generateDefaultTitle(createdAt),
          createdAt,
          textPreview,
          model,
          audioFile,
          audioUrl: `/uploads/${folderName}/${audioFile}`,
          hasTranscript,
          size,
          duration,
        });
      }

      // Sort newest first by createdAt timestamp
      items.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const total = items.length;
      const startIndex = (page - 1) * limit;
      const paginatedRecordings = items.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < total;

      return {
        recordings: paginatedRecordings,
        total,
        page,
        limit,
        hasMore,
      };
    } catch (error) {
      console.error("Failed to list recordings:", error);
      return {
        recordings: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
    }
  }

  async getRecordingById(id: string): Promise<RecordingDetail | null> {
    await this.ensureUploadsDir();

    const sanitizedId = this.sanitizeId(id);
    const folderPath = path.join(this.uploadsDir, sanitizedId);

    if (!fsSync.existsSync(folderPath)) {
      return null;
    }

    const jsonPath = path.join(folderPath, "transcription.json");
    let text = "";
    let title: string | undefined = undefined;
    let model = "gpt-4o-mini-transcribe";
    let createdAt = new Date().toISOString();
    let audioFile = "audio.webm";
    let duration: number | null = null;

    if (fsSync.existsSync(jsonPath)) {
      try {
        const rawJson = await fs.readFile(jsonPath, "utf-8");
        const data: TranscriptionJsonData = JSON.parse(rawJson);
        text = data.text || "";
        title = data.title;
        model = data.model || model;
        createdAt = data.createdAt || createdAt;
        audioFile = data.audioFile || audioFile;
        duration = data.duration ?? null;
      } catch (e) {
        console.error(`Error reading ${jsonPath}:`, e);
      }
    } else {
      const match = sanitizedId.match(/^recording-(\d+)/);
      if (match && match[1]) {
        createdAt = new Date(parseInt(match[1], 10)).toISOString();
      }

      try {
        const folderFiles = await fs.readdir(folderPath);
        const foundAudio = folderFiles.find(
          (f) =>
            f.startsWith("audio.") ||
            f.endsWith(".webm") ||
            f.endsWith(".mp4") ||
            f.endsWith(".wav") ||
            f.endsWith(".ogg") ||
            f.endsWith(".mp3") ||
            f.endsWith(".m4a") ||
            f.endsWith(".aac")
        );
        if (foundAudio) {
          audioFile = foundAudio;
        }
      } catch {
        // Ignore error
      }
    }

    let size = 0;
    const audioPath = path.join(/*turbopackIgnore: true*/ folderPath, audioFile);
    if (fsSync.existsSync(/*turbopackIgnore: true*/ audioPath)) {
      try {
        const stat = await fs.stat(/*turbopackIgnore: true*/ audioPath);
        size = stat.size;
      } catch {
        // Ignore stat error
      }
    }

    return {
      id: sanitizedId,
      title: title || this.generateDefaultTitle(createdAt),
      createdAt,
      text,
      model,
      audioFile,
      audioUrl: `/uploads/${sanitizedId}/${audioFile}`,
      duration,
      size,
      transcriptionJsonUrl: `/uploads/${sanitizedId}/transcription.json`,
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
    updates: { text?: string; title?: string }
  ): Promise<boolean> {
    await this.ensureUploadsDir();

    const sanitizedId = this.sanitizeId(id);
    const folderPath = path.join(this.uploadsDir, sanitizedId);

    if (!fsSync.existsSync(folderPath)) {
      return false;
    }

    const jsonPath = path.join(folderPath, "transcription.json");
    let existingData: Partial<TranscriptionJsonData> = {};

    if (fsSync.existsSync(jsonPath)) {
      try {
        const rawJson = await fs.readFile(jsonPath, "utf-8");
        existingData = JSON.parse(rawJson);
      } catch {
        existingData = {};
      }
    }

    const updatedData: TranscriptionJsonData = {
      title:
        updates.title !== undefined
          ? updates.title
          : existingData.title || this.generateDefaultTitle(existingData.createdAt || new Date().toISOString()),
      text: updates.text !== undefined ? updates.text : existingData.text || "",
      model: existingData.model || "gpt-4o-mini-transcribe",
      createdAt: existingData.createdAt || new Date().toISOString(),
      audioFile: existingData.audioFile || "audio.webm",
      duration: existingData.duration ?? null,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      jsonPath,
      JSON.stringify(updatedData, null, 2),
      "utf-8"
    );

    return true;
  }

  async deleteRecording(id: string): Promise<boolean> {
    await this.ensureUploadsDir();

    const sanitizedId = this.sanitizeId(id);
    const folderPath = path.join(this.uploadsDir, sanitizedId);

    if (!fsSync.existsSync(folderPath)) {
      return false;
    }

    try {
      await fs.rm(folderPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete recording folder ${folderPath}:`, error);
      return false;
    }
  }
}

export const fsRecordingStore = new FsRecordingStore();
