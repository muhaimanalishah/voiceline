import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import OpenAI, { toFile } from "openai";
import { r2RecordingStore } from "@/lib/recordings/r2-store";
import { drizzleRecordingStore } from "@/lib/recordings/drizzle-store";
import { validateCloudEnv } from "@/lib/recordings";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const validation = validateCloudEnv();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Cloud backend is not configured. Missing environment variables: ${validation.missing.join(
            ", "
          )}.`,
          missing: validation.missing,
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const model =
      process.env.OPENAI_TRANSCRIBE_MODEL ||
      process.env.OPENAI_TRANSCRIPTION_MODEL ||
      "gpt-4o-mini-transcribe";

    let folderId: string | null = null;
    let audioFileName = "audio.webm";
    let audioBuffer: Buffer | null = null;
    let mimeType = "audio/webm";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const paramFolderId = formData.get("folderId") as string | null;

      if (file) {
        mimeType = file.type || "audio/webm";
        let extension = ".webm";
        if (file.name && path.extname(file.name)) {
          extension = path.extname(file.name);
        } else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
          extension = ".mp3";
        } else if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
          extension = ".m4a";
        } else if (mimeType.includes("aac")) {
          extension = ".aac";
        } else if (mimeType.includes("ogg")) {
          extension = ".ogg";
        } else if (mimeType.includes("wav")) {
          extension = ".wav";
        }

        const uniqueId = crypto.randomUUID().slice(0, 8);
        const timestamp = Date.now();
        folderId = paramFolderId ? path.basename(paramFolderId) : `recording-${timestamp}-${uniqueId}`;
        audioFileName = `audio${extension}`;

        const bytes = await file.arrayBuffer();
        audioBuffer = Buffer.from(bytes);

        // Upload to Cloudflare R2
        await r2RecordingStore.saveAudioFile(
          folderId,
          audioFileName,
          audioBuffer,
          mimeType
        );
      } else if (paramFolderId) {
        folderId = path.basename(paramFolderId);
        // Fetch audio file from R2
        const detail = await r2RecordingStore.getRecordingById(folderId);
        if (detail && detail.audioFile) {
          audioFileName = detail.audioFile;
          // Get object buffer from R2
          const client = (r2RecordingStore as unknown as { getClient: () => any }).getClient();
          const { GetObjectCommand } = await import("@aws-sdk/client-s3");
          const getCmd = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || "",
            Key: `recordings/${folderId}/${audioFileName}`,
          });
          const resp = await client.send(getCmd);
          if (resp.Body) {
            const byteArray = await resp.Body.transformToByteArray();
            audioBuffer = Buffer.from(byteArray);
          }
        }
      }
    } else {
      // JSON body with folderId
      const body = await request.json();
      const rawFolderId =
        body.folderId || (body.folderPath ? path.basename(body.folderPath) : null);

      if (!rawFolderId) {
        return NextResponse.json(
          { error: "Missing folderId in request." },
          { status: 400 }
        );
      }

      folderId = path.basename(rawFolderId);

      // Fetch audio file from R2
      const detail = await r2RecordingStore.getRecordingById(folderId);
      if (!detail || !detail.audioFile) {
        return NextResponse.json(
          { error: `Recording audio not found in R2 for ID: ${folderId}` },
          { status: 404 }
        );
      }

      audioFileName = detail.audioFile;
      const client = (r2RecordingStore as unknown as { getClient: () => any }).getClient();
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const getCmd = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || "",
        Key: `recordings/${folderId}/${audioFileName}`,
      });
      const resp = await client.send(getCmd);
      if (!resp.Body) {
        return NextResponse.json(
          { error: `Could not read audio from storage for: ${folderId}` },
          { status: 404 }
        );
      }

      const byteArray = await resp.Body.transformToByteArray();
      audioBuffer = Buffer.from(byteArray);
    }

    if (!audioBuffer || !folderId) {
      return NextResponse.json(
        { error: "Audio data could not be located for transcription." },
        { status: 400 }
      );
    }

    // Call OpenAI Audio Transcriptions API using memory buffer
    const openaiFile = await toFile(audioBuffer, audioFileName, {
      type: mimeType,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: model,
    });

    const transcriptionText = transcription.text;
    const createdAt = new Date().toISOString();
    const defaultTitle = `Voice Note - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    const audioFileSize = audioBuffer.length;

    // Save to PostgreSQL with Drizzle ORM
    await drizzleRecordingStore.saveRecording({
      id: folderId,
      title: defaultTitle,
      transcript: transcriptionText,
      rawTranscript: transcriptionText,
      modelUsed: model,
      audioKey: `recordings/${folderId}/${audioFileName}`,
      audioStatus: "active",
      audioUrl: "",
      audioFile: audioFileName,
      size: audioFileSize,
      duration: null,
      createdAt,
    });

    return NextResponse.json({
      success: true,
      title: defaultTitle,
      text: transcriptionText,
      rawTranscript: transcriptionText,
      model,
      createdAt,
      audioFile: audioFileName,
      audioStatus: "active",
      folderId,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to transcribe audio.";
    return NextResponse.json(
      { error: `Transcription failed: ${message}` },
      { status: 500 }
    );
  }
}
