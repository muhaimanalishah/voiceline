import { NextRequest, NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";
import { processVoiceNote } from "@/lib/ai/process";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Recording ID is required." }, { status: 400 });
    }

    const note = await recordingStore.getRecordingById(id);
    if (!note) {
      return NextResponse.json({ error: `Note '${id}' not found.` }, { status: 404 });
    }

    const rawTranscript = note.rawTranscript?.trim() || "";
    if (!rawTranscript) {
      return NextResponse.json({ error: "Note has no transcript to process." }, { status: 400 });
    }

    const availableTags = (await recordingStore.getAllTags()) || [];
    const processed = await processVoiceNote({
      rawTranscript,
      noteId: id,
      currentTitle: note.title,
      currentTagId: note.tagId,
      currentSummary: note.summary,
      availableTags,
    });

    await recordingStore.updateRecording(id, {
      text: processed.cleanText,
      title: processed.title,
      tagId: processed.tagId,
      summary: processed.summary,
      embedding: processed.embedding,
      chunks: processed.chunks,
    });

    const updatedNote = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      id,
      text: processed.cleanText,
      rawTranscript: note.rawTranscript,
      isProcessed: true,
      title: processed.title,
      tagId: processed.tagId,
      tag: processed.tagName,
      summary: processed.summary,
      updatedAt: updatedNote?.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Processing error:", error);
    const message = error instanceof Error ? error.message : "Failed to process note.";
    return NextResponse.json({ error: `Processing failed: ${message}` }, { status: 500 });
  }
}