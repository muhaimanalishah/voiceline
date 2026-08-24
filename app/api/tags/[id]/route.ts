import { NextRequest, NextResponse } from "next/server";
import { recordingStore, validateDatabaseEnv } from "@/lib/recordings";

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
    const tag = await recordingStore.getTagById!(id);

    if (!tag) {
      return NextResponse.json(
        { error: `Tag '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tag,
    });
  } catch (error) {
    console.error("GET /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
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
    const body = await request.json();
    const { name, description, color } = body;

    if (name === undefined && description === undefined && color === undefined) {
      return NextResponse.json(
        { error: "Request body must include 'name', 'description', or 'color' to update." },
        { status: 400 }
      );
    }

    const updatedTag = await recordingStore.updateTag!(id, {
      name: typeof name === "string" ? name.trim() : undefined,
      description: typeof description === "string" ? description.trim() : undefined,
      color: typeof color === "string" || color === null ? color : undefined,
    });

    if (!updatedTag) {
      return NextResponse.json(
        { error: `Tag '${id}' not found or could not be updated.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tag: updatedTag,
    });
  } catch (error) {
    console.error("PATCH /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update tag." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
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
    const deleted = await recordingStore.deleteTag!(id);

    if (!deleted) {
      return NextResponse.json(
        { error: `Tag '${id}' not found or could not be deleted.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      message: "Tag deleted successfully. Associated transcripts have been unlinked.",
    });
  } catch (error) {
    console.error("DELETE /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete tag." },
      { status: 500 }
    );
  }
}

