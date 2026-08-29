import { NextResponse } from "next/server";
import { sqliteRecordingStore } from "@/lib/recordings/sqlite-store";
import { isDemoMode } from "@/lib/db/db";

export async function POST() {
  try {
    if (!isDemoMode) {
      return NextResponse.json(
        { error: "Reset demo data is only available when running in Demo Mode." },
        { status: 400 }
      );
    }

    await sqliteRecordingStore.seedDemoData(true);

    return NextResponse.json({
      success: true,
      message: "Demo notes and tags have been reset to defaults.",
    });
  } catch (error) {
    console.error("Failed to reset demo data:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset demo data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
