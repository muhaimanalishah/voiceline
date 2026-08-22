import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RecordingStore,
  RecordingItem,
  RecordingDetail,
  TranscriptionJsonData,
  PaginationOptions,
  PaginatedRecordings,
} from "./types";

export class R2RecordingStore implements RecordingStore {
  private client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || "";
    this.publicUrl = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, "") : "";
  }

  private getClient(): S3Client {
    if (!this.client) {
      const accountId = process.env.R2_ACCOUNT_ID || "";
      const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";

      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
    return this.client;
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

  private async getAudioUrl(id: string, audioFile: string): Promise<string> {
    const key = `recordings/${id}/${audioFile}`;
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      // Generate presigned URL valid for 24 hours
      return await getSignedUrl(this.getClient(), command, { expiresIn: 86400 });
    } catch (e) {
      console.error(`Failed to generate presigned URL for ${key}:`, e);
      return "";
    }
  }

  async getAllRecordings(options?: PaginationOptions): Promise<PaginatedRecordings> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 15));

    if (!this.bucket) {
      console.warn("R2_BUCKET_NAME is not configured.");
      return {
        recordings: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
    }

    try {
      const client = this.getClient();
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: "recordings/",
        Delimiter: "/",
      });

      const listResponse = await client.send(listCommand);
      const prefixes = listResponse.CommonPrefixes || [];
      const items: RecordingItem[] = [];

      for (const prefixObj of prefixes) {
        if (!prefixObj.Prefix) continue;
        const parts = prefixObj.Prefix.split("/").filter(Boolean);
        const folderId = parts[parts.length - 1];
        if (!folderId) continue;

        // Fetch objects in this subfolder
        const folderListCmd = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `recordings/${folderId}/`,
        });
        const folderListResp = await client.send(folderListCmd);
        const files = folderListResp.Contents || [];

        let text = "";
        let title: string | undefined = undefined;
        let model = "gpt-4o-mini-transcribe";
        let createdAt = new Date().toISOString();
        let audioFile = "audio.webm";
        let duration: number | null = null;
        let hasTranscript = false;
        let size = 0;

        const jsonFile = files.find((f) => f.Key === `recordings/${folderId}/transcription.json`);
        const foundAudio = files.find(
          (f) =>
            f.Key &&
            (f.Key.includes("/audio.") ||
              f.Key.endsWith(".webm") ||
              f.Key.endsWith(".mp4") ||
              f.Key.endsWith(".wav") ||
              f.Key.endsWith(".ogg") ||
              f.Key.endsWith(".mp3") ||
              f.Key.endsWith(".m4a") ||
              f.Key.endsWith(".aac"))
        );

        if (foundAudio && foundAudio.Key) {
          audioFile = foundAudio.Key.split("/").pop() || "audio.webm";
          size = foundAudio.Size || 0;
        }

        if (jsonFile) {
          try {
            const getCmd = new GetObjectCommand({
              Bucket: this.bucket,
              Key: `recordings/${folderId}/transcription.json`,
            });
            const getResp = await client.send(getCmd);
            if (getResp.Body) {
              const bodyString = await getResp.Body.transformToString();
              const data: TranscriptionJsonData = JSON.parse(bodyString);
              text = data.text || "";
              title = data.title;
              model = data.model || model;
              createdAt = data.createdAt || createdAt;
              audioFile = data.audioFile || audioFile;
              duration = data.duration ?? null;
              hasTranscript = true;
            }
          } catch (e) {
            console.error(`Error fetching transcription for ${folderId}:`, e);
          }
        } else {
          const match = folderId.match(/^recording-(\d+)/);
          if (match && match[1]) {
            createdAt = new Date(parseInt(match[1], 10)).toISOString();
          }
        }

        const audioUrl = await this.getAudioUrl(folderId, audioFile);
        const previewLength = 120;
        const textPreview =
          text.length > previewLength
            ? text.slice(0, previewLength).trim() + "..."
            : text || "(No transcription yet)";

        items.push({
          id: folderId,
          title: title || this.generateDefaultTitle(createdAt),
          createdAt,
          textPreview,
          model,
          audioFile,
          audioUrl,
          hasTranscript,
          size,
          duration,
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      console.error("Failed to list recordings from R2:", error);
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
    if (!this.bucket) return null;

    try {
      const client = this.getClient();
      const folderListCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `recordings/${id}/`,
      });
      const folderListResp = await client.send(folderListCmd);
      const files = folderListResp.Contents || [];

      if (files.length === 0) return null;

      let text = "";
      let title: string | undefined = undefined;
      let model = "gpt-4o-mini-transcribe";
      let createdAt = new Date().toISOString();
      let audioFile = "audio.webm";
      let duration: number | null = null;
      let size = 0;

      const foundAudio = files.find(
        (f) =>
          f.Key &&
          (f.Key.includes("/audio.") ||
            f.Key.endsWith(".webm") ||
            f.Key.endsWith(".mp4") ||
            f.Key.endsWith(".wav") ||
            f.Key.endsWith(".ogg"))
      );

      if (foundAudio && foundAudio.Key) {
        audioFile = foundAudio.Key.split("/").pop() || "audio.webm";
        size = foundAudio.Size || 0;
      }

      const jsonFile = files.find((f) => f.Key === `recordings/${id}/transcription.json`);
      if (jsonFile) {
        try {
          const getCmd = new GetObjectCommand({
            Bucket: this.bucket,
            Key: `recordings/${id}/transcription.json`,
          });
          const getResp = await client.send(getCmd);
          if (getResp.Body) {
            const bodyString = await getResp.Body.transformToString();
            const data: TranscriptionJsonData = JSON.parse(bodyString);
            text = data.text || "";
            title = data.title;
            model = data.model || model;
            createdAt = data.createdAt || createdAt;
            audioFile = data.audioFile || audioFile;
            duration = data.duration ?? null;
          }
        } catch (e) {
          console.error(`Error reading transcription for ${id}:`, e);
        }
      } else {
        const match = id.match(/^recording-(\d+)/);
        if (match && match[1]) {
          createdAt = new Date(parseInt(match[1], 10)).toISOString();
        }
      }

      const audioUrl = await this.getAudioUrl(id, audioFile);
      const transcriptionJsonUrl = this.publicUrl
        ? `${this.publicUrl}/recordings/${id}/transcription.json`
        : "";

      return {
        id,
        title: title || this.generateDefaultTitle(createdAt),
        createdAt,
        text,
        model,
        audioFile,
        audioUrl,
        duration,
        size,
        transcriptionJsonUrl,
      };
    } catch (error) {
      console.error(`Failed to get recording ${id} from R2:`, error);
      return null;
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
    if (!this.bucket) return false;

    try {
      const client = this.getClient();
      let existingData: Partial<TranscriptionJsonData> = {};

      try {
        const getCmd = new GetObjectCommand({
          Bucket: this.bucket,
          Key: `recordings/${id}/transcription.json`,
        });
        const getResp = await client.send(getCmd);
        if (getResp.Body) {
          const bodyString = await getResp.Body.transformToString();
          existingData = JSON.parse(bodyString);
        }
      } catch {
        existingData = {};
      }

      const createdAt = existingData.createdAt || new Date().toISOString();
      const updatedData: TranscriptionJsonData = {
        title:
          updates.title !== undefined
            ? updates.title
            : existingData.title || this.generateDefaultTitle(createdAt),
        text: updates.text !== undefined ? updates.text : existingData.text || "",
        model: existingData.model || "gpt-4o-mini-transcribe",
        createdAt,
        audioFile: existingData.audioFile || "audio.webm",
        duration: existingData.duration ?? null,
        updatedAt: new Date().toISOString(),
      };

      const putCmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: `recordings/${id}/transcription.json`,
        Body: JSON.stringify(updatedData, null, 2),
        ContentType: "application/json",
      });

      await client.send(putCmd);
      return true;
    } catch (error) {
      console.error(`Failed to update recording ${id} in R2:`, error);
      return false;
    }
  }

  async deleteRecording(id: string): Promise<boolean> {
    if (!this.bucket) return false;

    try {
      const client = this.getClient();
      const folderListCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `recordings/${id}/`,
      });
      const folderListResp = await client.send(folderListCmd);
      const objects = folderListResp.Contents || [];

      if (objects.length === 0) return true;

      const deleteCmd = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key })),
        },
      });

      await client.send(deleteCmd);
      return true;
    } catch (error) {
      console.error(`Failed to delete recording ${id} from R2:`, error);
      return false;
    }
  }

  async saveAudioFile(
    id: string,
    fileName: string,
    buffer: Buffer,
    contentType: string = "audio/webm"
  ): Promise<string> {
    const client = this.getClient();
    const key = `recordings/${id}/${fileName}`;
    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await client.send(putCmd);
    return await this.getAudioUrl(id, fileName);
  }

  async saveTranscriptionJson(
    id: string,
    data: TranscriptionJsonData
  ): Promise<void> {
    const client = this.getClient();
    const key = `recordings/${id}/transcription.json`;
    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });
    await client.send(putCmd);
  }
}

export const r2RecordingStore = new R2RecordingStore();
