import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { r2RecordingStore } from "@/lib/recordings/r2-store";
import { validateCloudEnv } from "@/lib/recordings";

export async function POST(request: NextRequest) {
  try {
    // Validate Cloud environment
    const validation = validateCloudEnv();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Cloud storage is not configured. Missing environment variables: ${validation.missing.join(
            ", "
          )}.`,
          missing: validation.missing,
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 25MB maximum limit." },
        { status: 400 }
      );
    }

    // Determine appropriate file extension based on MIME type or original name
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
    } else if (mimeType.includes("flac")) {
      extension = ".flac";
    } else if (mimeType.includes("webm")) {
      extension = ".webm";
    }

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const folderId = `recording-${timestamp}-${uniqueId}`;
    const filename = `audio${extension}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload directly to Cloudflare R2
    const audioUrl = await r2RecordingStore.saveAudioFile(
      folderId,
      filename,
      buffer,
      mimeType
    );

    return NextResponse.json({
      success: true,
      folderId,
      filename,
      originalName: file.name || "voice-recording",
      url: audioUrl,
      size: file.size,
      mimeType,
    });
  } catch (error) {
    console.error("Audio upload failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload audio file.",
      },
      { status: 500 }
    );
  }
}
