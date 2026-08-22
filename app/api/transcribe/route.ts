import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { r2RecordingStore } from "@/lib/recordings/r2-store";
import { drizzleRecordingStore } from "@/lib/recordings/drizzle-store";
import { TranscriptionJsonData } from "@/lib/recordings/types";
import { isLocalMode } from "@/lib/recordings";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const model =
      process.env.OPENAI_TRANSCRIBE_MODEL ||
      process.env.OPENAI_TRANSCRIPTION_MODEL ||
      "gpt-4o-mini-transcribe";

    let folderId: string | null = null;
    let audioFilePath: string | null = null;
    let audioFileName = "audio.webm";
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const paramFolderId = formData.get("folderId") as string | null;

      if (paramFolderId) {
        const sanitizedId = path.basename(paramFolderId);
        folderId = sanitizedId;
        const targetDir = path.join(uploadsRoot, sanitizedId);
        if (fsSync.existsSync(targetDir)) {
          const files = await fs.readdir(targetDir);
          const matchedAudio = files.find(
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
          if (matchedAudio) {
            audioFileName = matchedAudio;
            audioFilePath = path.join(targetDir, matchedAudio);
          }
        }
      }

      if (!audioFilePath && file) {
        const mimeType = file.type || "audio/webm";
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
        folderId = `recording-${timestamp}-${uniqueId}`;
        audioFileName = `audio${extension}`;

        const recordingDir = path.join(uploadsRoot, folderId);
        await fs.mkdir(recordingDir, { recursive: true });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        audioFilePath = path.join(recordingDir, audioFileName);
        await fs.writeFile(audioFilePath, buffer);

        // In Cloud mode (default), upload to Cloudflare R2
        if (!isLocalMode()) {
          try {
            await r2RecordingStore.saveAudioFile(
              folderId,
              audioFileName,
              buffer,
              mimeType
            );
          } catch (err) {
            console.error("Failed to upload audio to Cloudflare R2:", err);
          }
        }
      }
    } else {
      // JSON body
      const body = await request.json();
      const rawFolderId =
        body.folderId || (body.folderPath ? path.basename(body.folderPath) : null);

      if (!rawFolderId) {
        return NextResponse.json(
          { error: "Missing folderId or audio file in request." },
          { status: 400 }
        );
      }

      folderId = path.basename(rawFolderId);
      const targetDir = path.join(uploadsRoot, folderId);

      try {
        const files = await fs.readdir(targetDir);
        const matchedAudio = files.find(
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
        if (!matchedAudio) {
          return NextResponse.json(
            { error: `No audio file found in recording folder: ${folderId}` },
            { status: 404 }
          );
        }
        audioFileName = matchedAudio;
        audioFilePath = path.join(targetDir, matchedAudio);
      } catch {
        return NextResponse.json(
          { error: `Recording folder not found: ${folderId}` },
          { status: 404 }
        );
      }
    }

    if (!audioFilePath || !fsSync.existsSync(audioFilePath) || !folderId) {
      return NextResponse.json(
        { error: "Audio file could not be located on server for transcription." },
        { status: 400 }
      );
    }

    // Call OpenAI Audio Transcriptions API
    const audioStream = fsSync.createReadStream(audioFilePath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: model,
    });

    const transcriptionText = transcription.text;
    const createdAt = new Date().toISOString();
    const defaultTitle = `Voice Note - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    let audioFileSize = 0;
    try {
      const stat = await fs.stat(audioFilePath);
      audioFileSize = stat.size;
    } catch {
      // Ignore stat error
    }

    const transcriptionData: TranscriptionJsonData = {
      title: defaultTitle,
      text: transcriptionText,
      rawTranscript: transcriptionText,
      model,
      createdAt,
      audioFile: audioFileName,
      audioStatus: "active",
      duration: null,
    };

    // 1. Save transcription.json on disk
    const jsonFilePath = path.join(uploadsRoot, folderId, "transcription.json");
    await fs.writeFile(
      jsonFilePath,
      JSON.stringify(transcriptionData, null, 2),
      "utf-8"
    );

    // 2. In Cloud mode, save transcription.json metadata to R2
    if (!isLocalMode()) {
      try {
        await r2RecordingStore.saveTranscriptionJson(folderId, transcriptionData);
      } catch (err) {
        console.error("Failed to save transcription.json to R2:", err);
      }
    }

    // 3. Save to PostgreSQL with Drizzle ORM (Cloud mode default)
    try {
      await drizzleRecordingStore.saveRecording({
        id: folderId,
        title: defaultTitle,
        transcript: transcriptionText,
        rawTranscript: transcriptionText,
        modelUsed: model,
        audioKey: `recordings/${folderId}/${audioFileName}`,
        audioStatus: "active",
        audioUrl: `/uploads/${folderId}/${audioFileName}`,
        audioFile: audioFileName,
        size: audioFileSize,
        duration: null,
        createdAt,
      });
    } catch (dbErr) {
      console.warn("Could not save new recording to database:", dbErr);
    }

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
      transcriptionJsonUrl: `/uploads/${folderId}/transcription.json`,
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
