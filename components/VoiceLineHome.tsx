"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, Plus, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import AudioRecorder from "./AudioRecorder";
import TagGroup from "./TagGroup";
import {
  NewTagModal,
  RenameTagModal,
  DeleteTagModal,
  ManageTagsModal,
  ShortcutsModal,
} from "./TagModals";
import {
  Button,
  SearchInput,
  Kbd,
  Spinner,
} from "@/components/ui";
import { TagWithCount } from "@/lib/recordings/types";
import { useTagsQuery } from "@/lib/hooks/queries/useTags";
import { queryKeys } from "@/lib/query/keys";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import styles from "./VoiceLineHome.module.css";

export default function VoiceLineHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useTagsQuery();

  const tags = data?.tags || [];
  const unclassifiedCount = data?.unclassifiedCount || 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleRecordingCreated = (createdId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    router.push(`/notes/${encodeURIComponent(createdId)}`);
  };

  // Keyboard Shortcuts
  useKeyboardShortcut("cmd+k", () => searchInputRef.current?.focus());
  useKeyboardShortcut("/", () => searchInputRef.current?.focus());
  useKeyboardShortcut("alt+n", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  useKeyboardShortcut("?", () => setShowShortcuts((v) => !v));
  useKeyboardShortcut("escape", () => {
    if (showShortcuts) setShowShortcuts(false);
    if (showNewTag) setShowNewTag(false);
    if (showManageTags) setShowManageTags(false);
  });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Mic size={16} className={styles.brandIcon} />
          <span>VoiceLine</span>
        </div>

        <section className={styles.recorderSection}>
          <AudioRecorder onRecordingCreated={handleRecordingCreated} />
        </section>

        <div className={styles.toolbar}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search notes or transcripts..."
            value={searchQuery}
            onChange={setSearchQuery}
            shortcut="⌘K"
          />
          <Button
            variant="ghost"
            onClick={() => setShowNewTag(true)}
            icon={<Plus size={14} />}
          >
            New tag
          </Button>
          <Button
            variant="icon"
            onClick={() => setShowManageTags(true)}
            title="Manage tags"
            aria-label="Manage tags"
            icon={<Settings size={15} />}
          />
        </div>

        {isLoading ? (
          <div className={styles.loadingSpinner}>
            <Spinner size="xl" />
          </div>
        ) : (
          <div className={styles.groupsList}>
            <TagGroup
              tagId={null}
              name="Unclassified"
              description="no tag assigned yet"
              totalCount={unclassifiedCount}
              defaultOpen
              searchQuery={searchQuery}
            />

            {tags.map((tag) => (
              <TagGroup
                key={tag.id}
                tagId={tag.id}
                name={tag.name}
                description={tag.description}
                color={tag.color}
                totalCount={tag.recordingCount}
                searchQuery={searchQuery}
                onRename={() => setRenameTarget(tag)}
                onDelete={() => setDeleteTarget(tag)}
              />
            ))}
          </div>
        )}

        <div className={styles.shortcutBar} onClick={() => setShowShortcuts(true)}>
          <div className={styles.shortcutItem}>
            <Kbd>⌘K</Kbd>
            <span>Search</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <Kbd>Alt+N</Kbd>
            <span>Record</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <Kbd>?</Kbd>
            <span>Shortcuts</span>
          </div>
        </div>
      </div>

      {showNewTag && (
        <NewTagModal onClose={() => setShowNewTag(false)} />
      )}
      {showManageTags && (
        <ManageTagsModal
          tags={tags}
          isLoading={isLoading}
          onClose={() => setShowManageTags(false)}
        />
      )}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
      {renameTarget && (
        <RenameTagModal
          tag={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteTagModal
          tag={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
