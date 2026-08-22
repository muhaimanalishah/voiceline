import { NextRequest, NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const result = await recordingStore.getAllRecordings({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
    });

    return NextResponse.json({
      success: true,
      recordings: result.recordings,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("GET /api/recordings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings." },
      { status: 500 }
    );
  }
}
