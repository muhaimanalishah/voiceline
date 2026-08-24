import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { recordingStore } from "@/lib/recordings";
import {
  createClassificationSchema,
  NoTagsClassificationSchema,
} from "@/lib/validations/classification";

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

    const rawOrCurrentTranscript = note.rawTranscript?.trim() || note.text?.trim();
    if (!rawOrCurrentTranscript) {
      return NextResponse.json(
        { error: "Note has no transcript to classify." },
        { status: 400 }
      );
    }

    // Retrieve available tags from the database
    const availableTags = (await recordingStore.getAllTags()) || [];
    const hasTags = availableTags.length > 0;

    const openai = new OpenAI({ apiKey });
    const processingModel =
      process.env.PROCESSING_MODEL ||
      process.env.OPENAI_PROCESSING_MODEL ||
      "gpt-5-nano";

    const tagListPrompt = availableTags
      .map((t) => `- id: "${t.id}", name: "${t.name}", description: ${t.description}`)
      .join("\n");

    const systemPrompt = hasTags
      ? [
          "You are an expert AI assistant that processes, translates, summarizes, and classifies voice notes.",
          "Analyze the user's voice note transcript and perform the following tasks in order:",
          "1. Translation & Speech Polish (translatedText): Convert the entire transcript into natural, clear, fluent English. Strictly preserve the exact meaning, conversational flow, nuance, and structural points without fabricating or omitting information. If the transcript is already in English, keep it as English while polishing minor speech/filler artifacts.",
          "2. Title Generation (title): Generate a concise, descriptive English title between 3 to 6 words maximum.",
          "3. Bullet Summary (summary): Generate 2 to 4 concise bullet summary points in English capturing key takeaways, decisions, or action items.",
          "4. Tag Assignment (tagId): Choose the id of the single most appropriate matching tag from the list below. You must return one of these exact ids.",
          "",
          "Available tags:",
          tagListPrompt,
          "",
          'Guidance on picking a tag: always prefer the most specific tag whose description genuinely matches the content of the note. Only choose the tag named "Others" as a last resort, when the note truly does not fit any of the other tags.',
        ].join("\n")
      : [
          "You are an expert AI assistant that processes, translates, and summarizes voice notes.",
          "Analyze the user's voice note transcript and perform the following tasks in order:",
          "1. Translation & Speech Polish (translatedText): Convert the entire transcript into natural, clear, fluent English. Strictly preserve the exact meaning, conversational flow, nuance, and structural points without fabricating or omitting information. If the transcript is already in English, keep it as English while polishing minor speech/filler artifacts.",
          "2. Title Generation (title): Generate a concise, descriptive English title between 3 to 6 words maximum.",
          "3. Bullet Summary (summary): Generate 2 to 4 concise bullet summary points in English capturing key takeaways, decisions, or action items.",
        ].join("\n");

    const tagIds = availableTags.map((t) => t.id) as [string, ...string[]];
    const schema = hasTags
      ? createClassificationSchema(tagIds)
      : NoTagsClassificationSchema;

    const completion = await openai.chat.completions.create({
      model: processingModel,
      response_format: zodResponseFormat(schema, "note_classification"),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: rawOrCurrentTranscript,
        },
      ],
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI model.");
    }

    const rawParsed = JSON.parse(responseContent);
    const parsed = schema.parse(rawParsed);
    if (!parsed || !parsed.title) {
      throw new Error("Failed to generate classification from AI.");
    }

    const parsedTitle = parsed.title.trim();
    const parsedTranslatedText = parsed.translatedText?.trim() || note.text;
    const parsedTagId = "tagId" in parsed ? (parsed.tagId as string) : null;
    const parsedSummary = Array.isArray(parsed.summary) ? parsed.summary : [];

    let matchedTag: { id: string; name: string } | null = null;
    if (hasTags && parsedTagId) {
      matchedTag = availableTags.find((t) => t.id === parsedTagId) || null;
    }

    // Update note transcript (with translated text), title, tagId, summary, and isClassified flag
    await recordingStore.updateRecording(id, {
      text: parsedTranslatedText,
      title: parsedTitle,
      tagId: matchedTag?.id ?? null,
      summary: parsedSummary,
      isClassified: true,
    });
    const updatedNote = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      id,
      text: parsedTranslatedText,
      title: parsedTitle,
      tagId: matchedTag?.id ?? null,
      tag: matchedTag?.name ?? null,
      summary: parsedSummary,
      isClassified: true,
      updatedAt: updatedNote?.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Classification error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to classify note.";
    return NextResponse.json(
      { error: `Classification failed: ${message}` },
      { status: 500 }
    );
  }
}
