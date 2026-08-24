import { notFound } from "next/navigation";
import { recordingStore } from "@/lib/recordings";
import NotePageClient from "./note-page-client";

export default async function NotePage(props: PageProps<"/notes/[id]">) {
  const { id } = await props.params;
  const recording = await recordingStore.getRecordingById(id);

  if (!recording) {
    notFound();
  }

  return <NotePageClient recording={recording} />;
}
