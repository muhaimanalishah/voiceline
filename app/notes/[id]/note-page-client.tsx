"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TranscriptEditor from "@/components/TranscriptEditor";
import AudioRecorder from "@/components/AudioRecorder";
import AskSidePanel from "@/components/AskSidePanel";
import { RecordingDetail } from "@/lib/recordings/types";
import {
  useUpdateRecordingMutation,
  useDeleteRecordingMutation,
} from "@/hooks/queries/useRecordings";
import styles from "./note-page.module.css";

interface NotePageClientProps {
  recording: RecordingDetail;
}

export default function NotePageClient({ recording }: NotePageClientProps) {
  const router = useRouter();
  const [isAskPanelOpen, setIsAskPanelOpen] = useState(false);
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
    <div className={styles.pageLayout}>
      <div className={styles.mainColumn}>
        <TranscriptEditor
          recording={recording}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
        <AudioRecorder
          onRecordingCreated={(createdId) => {
            router.push(`/notes/${encodeURIComponent(createdId)}`);
          }}
          onOpenAsk={() => setIsAskPanelOpen((v) => !v)}
        />
      </div>

      <AskSidePanel
        isOpen={isAskPanelOpen}
        onClose={() => setIsAskPanelOpen(false)}
      />
    </div>
  );
}
