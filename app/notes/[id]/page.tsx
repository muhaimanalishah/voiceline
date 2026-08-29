import { notFound } from "next/navigation";
import { recordingStore } from "@/lib/recordings";
import NotePageClient from "./note-page-client";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recording = await recordingStore.getRecordingById(id);

  if (!recording) {
    notFound();
  }

  return <NotePageClient recording={recording} />;
}
