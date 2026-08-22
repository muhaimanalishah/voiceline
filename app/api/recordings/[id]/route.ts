import { NextRequest, NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const recording = await recordingStore.getRecordingById(id);

    if (!recording) {
      return NextResponse.json(
        { error: `Recording '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recording,
    });
  } catch (error) {
    console.error("GET /api/recordings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recording details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { text } = body;

    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field in request body." },
        { status: 400 }
      );
    }

    const updated = await recordingStore.updateTranscription(id, text);

    if (!updated) {
      return NextResponse.json(
        { error: `Recording '${id}' not found or could not be updated.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      text,
    });
  } catch (error) {
    console.error("PATCH /api/recordings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update transcription." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const deleted = await recordingStore.deleteRecording(id);

    if (!deleted) {
      return NextResponse.json(
        { error: `Recording '${id}' not found or could not be deleted.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    console.error("DELETE /api/recordings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete recording." },
      { status: 500 }
    );
  }
}
