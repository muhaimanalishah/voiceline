"use client";

import { useRouter } from "next/navigation";
import TranscriptEditor from "@/components/TranscriptEditor";
import { RecordingDetail } from "@/lib/recordings/types";

interface NotePageClientProps {
  recording: RecordingDetail;
}

export default function NotePageClient({ recording }: NotePageClientProps) {
  const router = useRouter();

  const handleUpdate = async (
    id: string,
    newText: string,
    newTitle?: string
  ) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: newText, title: newTitle }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to update transcription.");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to delete recording.");
    }

    router.push("/");
  };

  return (
    <TranscriptEditor
      recording={recording}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}
