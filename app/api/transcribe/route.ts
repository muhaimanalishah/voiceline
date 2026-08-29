import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { transcribe } from "ai";
import { openai } from '@ai-sdk/openai';
import { recordingStore } from "@/lib/recordings";
import { processVoiceNote } from "@/lib/ai/process";
import { isDemoMode } from "@/lib/db/db";

const sampleDemoTranscripts = [
  "Um quick voice memo during team standup: We reviewed the new hybrid search engine, and everyone agreed the SQLite fallback is a lifesaver for local demos. Let's make sure the export to markdown works seamlessly, you know.",
  "Hey so idea for the next sprint: Implement keyboard navigation for switching between raw and clean transcripts. Also check if we can add custom color palettes for tag creation.",
  "Meeting with product lead: Discussed how Voiceline AI handles citations. Showing the relevant notes at the bottom of the answer makes verification much easier for users.",
  "Personal reflection today: Focusing on consistent daily habits over intense weekly bursts. Keeping track of quick voice memos helps clear cognitive load.",
];

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const isMock = isDemoMode || !apiKey;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file && !isMock) {
      return NextResponse.json(
        { error: "No audio file provided for transcription." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file && file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 25MB maximum limit." },
        { status: 400 }
      );
    }

    let mimeType = file?.type || "audio/webm";
    let filename = file?.name || "recording.webm";

    if (/\.(aac|acc)$/i.test(filename) || mimeType.includes("aac")) {
      filename = filename.replace(/\.(aac|acc)$/i, "") + ".m4a";
      if (!filename.endsWith(".m4a")) filename += ".m4a";
      mimeType = "audio/m4a";
    }

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const noteId = `note-${timestamp}-${uniqueId}`;
    const model = isMock ? "mock-transcribe-v1" : (process.env.TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");

    let transcriptionText = "";

    if (isMock) {
      const randomIndex = Math.floor(Math.random() * sampleDemoTranscripts.length);
      transcriptionText = sampleDemoTranscripts[randomIndex];
    } else {
      const bytes = await file!.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const transcription = await transcribe({
        model: openai.transcription(model),
        audio: buffer,
      });
      transcriptionText = transcription.text;
    }
    const createdAt = new Date().toISOString();
    const defaultTitle = `Voice Note - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    // PHASE 1: Immediate Persistence (Guaranteed baseline save)
    await recordingStore.saveRecording({
      id: noteId,
      title: defaultTitle,
      transcript: null,
      rawTranscript: transcriptionText,
      modelUsed: model,
      createdAt,
    });

    // PHASE 2: Graceful Auto-Processing + Embedding Indexing
    try {
      const availableTags = (await recordingStore.getAllTags()) || [];
      const processed = await processVoiceNote({
        rawTranscript: transcriptionText,
        noteId,
        currentTitle: defaultTitle,
        availableTags,
      });

      await recordingStore.updateRecording(noteId, {
        text: processed.cleanText,
        title: processed.title,
        tagId: processed.tagId,
        summary: processed.summary,
        embedding: processed.embedding,
        chunks: processed.chunks,
      });

      return NextResponse.json({
        success: true,
        id: noteId,
        title: processed.title,
        text: processed.cleanText,
        rawTranscript: transcriptionText,
        summary: processed.summary,
        tagId: processed.tagId,
        tag: processed.tagName,
        isProcessed: true,
        model,
        createdAt,
      });
    } catch (processError) {
      console.error("Auto-processing failed, returning raw note:", processError);
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
    }
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