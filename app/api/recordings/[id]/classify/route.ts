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

    const openai = new OpenAI({ apiKey });
    const processingModel =
      process.env.PROCESSING_MODEL ||
      process.env.OPENAI_PROCESSING_MODEL ||
      "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model: processingModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that classifies voice notes. Analyze the transcript and generate a concise, descriptive title between 3 to 6 words maximum. Return your output as a JSON object with a single 'title' key.",
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
    try {
      const parsed = JSON.parse(responseContent);
      parsedTitle = parsed.title?.trim();
    } catch {
      throw new Error("Failed to parse classification response from AI.");
    }

    if (!parsedTitle) {
      throw new Error("Generated title was empty.");
    }

    // Update note title in PostgreSQL
    await recordingStore.updateRecording!(id, { title: parsedTitle });
    const updatedNote = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      id,
      title: parsedTitle,
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

