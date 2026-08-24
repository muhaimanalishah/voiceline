import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import OpenAI, { toFile } from "openai";
import { drizzleRecordingStore } from "@/lib/recordings/drizzle-store";
import { validateDatabaseEnv } from "@/lib/recordings";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const validation = validateDatabaseEnv();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Database is not configured. Missing environment variables: ${validation.missing.join(
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

    const mimeType = file.type || "audio/webm";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const openai = new OpenAI({ apiKey });
    const model =
      process.env.TRANSCRIBE_MODEL ||
      process.env.OPENAI_TRANSCRIBE_MODEL ||
      process.env.OPENAI_TRANSCRIPTION_MODEL ||
      "gpt-4o-mini-transcribe";


    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const noteId = `note-${timestamp}-${uniqueId}`;

    const filename = file.name || "recording.webm";
    const openaiFile = await toFile(buffer, filename, {
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

    // Insert note directly into database
    await drizzleRecordingStore.saveRecording({
      id: noteId,
      title: defaultTitle,
      transcript: transcriptionText,
      rawTranscript: transcriptionText,
      modelUsed: model,
      createdAt,
    });

    return NextResponse.json({
      success: true,
      id: noteId,
      folderId: noteId,
      title: defaultTitle,
      text: transcriptionText,
      rawTranscript: transcriptionText,
      model,
      createdAt,
    });
  } catch (error) {
    console.error("Audio upload and transcription failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process audio.",
      },
      { status: 500 }
    );
  }
}

