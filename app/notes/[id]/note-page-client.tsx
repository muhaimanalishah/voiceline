"use client";

import { useRouter } from "next/navigation";
import TranscriptEditor from "@/components/TranscriptEditor";
import AudioRecorder from "@/components/AudioRecorder";
import { RecordingDetail } from "@/lib/recordings/types";
import {
  useUpdateRecordingMutation,
  useDeleteRecordingMutation,
} from "@/lib/hooks/queries/useRecordings";

interface NotePageClientProps {
  recording: RecordingDetail;
}

export default function NotePageClient({ recording }: NotePageClientProps) {
  const router = useRouter();
  const updateMutation = useUpdateRecordingMutation();
  const deleteMutation = useDeleteRecordingMutation();

  const handleUpdate = async (
    id: string,
    newText: string,
    newTitle?: string
  ) => {
    await updateMutation.mutateAsync({
      id,
      text: newText,
      title: newTitle,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    router.push("/");
  };

  return (
    <>
      <TranscriptEditor
        recording={recording}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
      <AudioRecorder
        onRecordingCreated={(createdId) => {
          router.push(`/notes/${encodeURIComponent(createdId)}`);
        }}
      />
    </>
  );
}
