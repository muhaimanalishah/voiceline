import { NextRequest, NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Recording ID is required." },
        { status: 400 }
      );
    }

    const detail = await recordingStore.getRecordingById(id);
    if (!detail) {
      return NextResponse.json(
        { error: "Recording not found." },
        { status: 404 }
      );
    }

    const success = await recordingStore.resetToRawTranscript(id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to reset transcript to raw text." },
        { status: 500 }
      );
    }

    const updated = await recordingStore.getRecordingById(id);

    return NextResponse.json({
      success: true,
      text: updated?.text || detail.rawTranscript || detail.text,
      rawTranscript: updated?.rawTranscript || detail.rawTranscript,
    });
  } catch (error) {
    console.error("POST reset transcript error:", error);
    return NextResponse.json(
      { error: "Failed to reset transcript." },
      { status: 500 }
    );
  }
}
