import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { recordingStore, validateDatabaseEnv } from "@/lib/recordings";

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

    const transcript = note.text?.trim() || note.rawTranscript?.trim();
    if (!transcript) {
      return NextResponse.json(
        { error: "Note has no transcript to classify." },
        { status: 400 }
      );
    }

    // Retrieve available tags from the database. If none exist, tagging is
    // skipped entirely and the note is left unclassified (tagId: null) —
    // this is a distinct state from being deliberately tagged "Others".
    const availableTags = (await recordingStore.getAllTags?.()) || [];
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
          "You are a helpful assistant that classifies voice notes.",
          "Analyze the transcript and generate:",
          "1. A concise, descriptive title between 3 to 6 words maximum.",
          "2. The id of the single most appropriate tag from the list below. You must return one of these exact ids, never a new tag name.",
          "",
          "Available tags:",
          tagListPrompt,
          "",
          "Guidance on picking a tag: always prefer the most specific tag whose description genuinely matches the content of the note. Only choose the tag named \"Others\" as a last resort, when the note truly does not fit any of the other tags.",
          "",
          'Return your response strictly as a JSON object with this structure: { "title": string, "tagId": string }',
        ].join("\n")
      : [
          "You are a helpful assistant that classifies voice notes.",
          "Analyze the transcript and generate a concise, descriptive title between 3 to 6 words maximum.",
          "",
          'Return your response strictly as a JSON object with this structure: { "title": string }',
        ].join("\n");

    const completion = await openai.chat.completions.create({
      model: processingModel,
      response_format: hasTags
        ? {
            type: "json_schema",
            json_schema: {
              name: "note_classification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  tagId: {
                    type: "string",
                    enum: availableTags.map((t) => t.id),
                  },
                },
                required: ["title", "tagId"],
                additionalProperties: false,
              },
            },
          }
        : {
            type: "json_schema",
            json_schema: {
              name: "note_title",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                },
                required: ["title"],
                additionalProperties: false,
              },
            },
          },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI model.");
    }

    let parsedTitle = "";
    let parsedTagId = "";
    try {
      const parsed = JSON.parse(responseContent);
      parsedTitle = typeof parsed.title === "string" ? parsed.title.trim() : "";
      parsedTagId = typeof parsed.tagId === "string" ? parsed.tagId.trim() : "";
    } catch {
      throw new Error("Failed to parse classification response from AI.");
    }

    if (!parsedTitle) {
      throw new Error("Generated title was empty.");
    }

    let matchedTag: { id: string; name: string } | null = null;
    if (hasTags) {
      matchedTag = availableTags.find((t) => t.id === parsedTagId) || null;
      if (!matchedTag) {
        throw new Error(`AI returned an unrecognized tag id: "${parsedTagId}".`);
      }
    }

    // Update note title and tagId (null when unclassified) in PostgreSQL
    await recordingStore.updateRecording!(id, {
      title: parsedTitle,
      tagId: matchedTag?.id ?? null,
    });
    const updatedNote = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      id,
      title: parsedTitle,
      tagId: matchedTag?.id ?? null,
      tag: matchedTag?.name ?? null,
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


