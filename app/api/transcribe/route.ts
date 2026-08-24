import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import OpenAI, { toFile } from "openai";
import { recordingStore } from "@/lib/recordings";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided for transcription." },
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

    let mimeType = file.type || "audio/webm";
    let filename = file.name || "recording.webm";

    // OpenAI Whisper supported formats: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
    // Map .aac / .acc files to .m4a so OpenAI Whisper decodes the AAC audio stream
    if (/\.(aac|acc)$/i.test(filename) || mimeType.includes("aac")) {
      filename = filename.replace(/\.(aac|acc)$/i, "") + ".m4a";
      if (!filename.endsWith(".m4a")) filename += ".m4a";
      mimeType = "audio/m4a";
    }

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

    // Save directly to PostgreSQL (transcript is null until processed)
    await recordingStore.saveRecording({
      id: noteId,
      title: defaultTitle,
      transcript: null,
      rawTranscript: transcriptionText,
      modelUsed: model,
      createdAt,
    });

    return NextResponse.json({
      success: true,
      id: noteId,
      title: defaultTitle,
      text: null,
      rawTranscript: transcriptionText,
      isProcessed: false,
      model,
      createdAt,
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

