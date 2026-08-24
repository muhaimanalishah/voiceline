import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { recordingStore } from "@/lib/recordings";
import { buildProcessSchemaAndPrompt } from "@/lib/validations/classification";
import { toTitleCase, isDefaultTitle } from "@/lib/utils/format";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Recording ID is required." },
        { status: 400 }
      );
    }

    const note = await recordingStore.getRecordingById(id);
    if (!note) {
      return NextResponse.json(
        { error: `Note '${id}' not found.` },
        { status: 404 }
      );
    }

    const rawTranscript = note.rawTranscript?.trim() || note.text?.trim() || "";
    if (!rawTranscript) {
      return NextResponse.json(
        { error: "Note has no transcript to process." },
        { status: 400 }
      );
    }

    // Retrieve available tags from the database
    const availableTags = (await recordingStore.getAllTags()) || [];

    // Evaluate dynamic conditions
    const wordCount = rawTranscript.split(/\s+/).filter(Boolean).length;
    const needsTitle = isDefaultTitle(note.title, note.id);
    const needsSummary = wordCount >= 500;
    const needsTag = !note.tagId && availableTags.length > 0;

    const { schema, systemPrompt } = buildProcessSchemaAndPrompt({
      needsTitle,
      needsSummary,
      needsTag,
      availableTags,
    });

    const openai = new OpenAI({ apiKey });
    const processingModel =
      process.env.PROCESSING_MODEL ||
      process.env.OPENAI_PROCESSING_MODEL ||
      "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model: processingModel,
      response_format: zodResponseFormat(schema, "voice_note_process"),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: rawTranscript,
        },
      ],
      temperature: 0.2,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI model.");
    }

    const rawParsed = JSON.parse(responseContent);
    const parsed = schema.parse(rawParsed);

    const finalCleanText =
      (typeof parsed.cleanText === "string" && parsed.cleanText.trim()) ||
      note.text ||
      rawTranscript;

    const finalTitle =
      needsTitle && typeof parsed.title === "string" && parsed.title.trim()
        ? toTitleCase(parsed.title)
        : (note.title || note.id);

    const finalSummary =
      needsSummary && Array.isArray(parsed.summary)
        ? parsed.summary
        : (note.summary || null);

    const finalTagId =
      needsTag && typeof parsed.tagId === "string"
        ? parsed.tagId
        : (note.tagId ?? null);

    let matchedTag: { id: string; name: string } | null = null;
    if (finalTagId) {
      matchedTag = availableTags.find((t) => t.id === finalTagId) || null;
    }

    // Save cleanText into the transcript column and update title, tagId, summary
    await recordingStore.updateRecording(id, {
      text: finalCleanText,
      title: finalTitle,
      tagId: finalTagId,
      summary: finalSummary,
    });

    const updatedNote = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      id,
      text: finalCleanText,
      rawTranscript: note.rawTranscript,
      isProcessed: true,
      title: finalTitle,
      tagId: finalTagId,
      tag: matchedTag?.name ?? null,
      summary: finalSummary,
      updatedAt: updatedNote?.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Processing error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process note.";
    return NextResponse.json(
      { error: `Processing failed: ${message}` },
      { status: 500 }
    );
  }
}

