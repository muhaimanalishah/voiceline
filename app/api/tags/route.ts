import { NextRequest, NextResponse } from "next/server";
import { recordingStore } from "@/lib/recordings";

export async function GET() {
  try {
    const tags = await recordingStore.getAllTagsWithCounts();
    const unclassifiedCount = await recordingStore.getUnclassifiedCount();
    return NextResponse.json({
      success: true,
      tags,
      unclassifiedCount,
    });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, id } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required." },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Tag description is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const existingTags = await recordingStore.getAllTags();
    const isDuplicate = existingTags.some(
      (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: `A tag with name "${trimmedName}" already exists.` },
        { status: 409 }
      );
    }

    const createdTag = await recordingStore.createTag({
      id: typeof id === "string" && id.trim() ? id.trim() : undefined,
      name: trimmedName,
      description: description.trim(),
      color: typeof color === "string" ? color.trim() : null,
    });

    return NextResponse.json(
      {
        success: true,
        tag: createdTag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tags error:", error);
    return NextResponse.json(
      { error: "Failed to create tag." },
      { status: 500 }
    );
  }
}

