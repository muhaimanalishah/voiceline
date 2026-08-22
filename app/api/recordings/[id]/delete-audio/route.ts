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

    const success = await recordingStore.deleteAudioOnly?.(id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete audio file." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Audio file deleted successfully. Transcript preserved.",
      audioStatus: "deleted",
    });
  } catch (error) {
    console.error("POST delete-audio error:", error);
    return NextResponse.json(
      { error: "Failed to delete audio file." },
      { status: 500 }
    );
  }
}
