import { NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";

export async function GET() {
  try {
    const recordings = await recordingStore.getAllRecordings();
    return NextResponse.json({
      success: true,
      recordings,
    });
  } catch (error) {
    console.error("GET /api/recordings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings." },
      { status: 500 }
    );
  }
}
