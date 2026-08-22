import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    // Determine appropriate file extension based on MIME type or original name
    const mimeType = file.type || "audio/webm";
    let extension = ".webm";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
      extension = ".mp4";
    } else if (mimeType.includes("ogg")) {
      extension = ".ogg";
    } else if (mimeType.includes("wav")) {
      extension = ".wav";
    } else if (mimeType.includes("webm")) {
      extension = ".webm";
    } else if (file.name && path.extname(file.name)) {
      extension = path.extname(file.name);
    }

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const folderId = `recording-${timestamp}-${uniqueId}`;
    const filename = `audio${extension}`;

    // Target upload directory: public/uploads/<folderId>/
    const recordingDir = path.join(process.cwd(), "public", "uploads", folderId);
    await fs.mkdir(recordingDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const destinationPath = path.join(recordingDir, filename);

    await fs.writeFile(destinationPath, buffer);

    return NextResponse.json({
      success: true,
      folderId,
      filename,
      url: `/uploads/${folderId}/${filename}`,
      filepath: destinationPath,
      size: file.size,
      mimeType,
    });
  } catch (error) {
    console.error("Audio upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload and save audio file." },
      { status: 500 }
    );
  }
}
