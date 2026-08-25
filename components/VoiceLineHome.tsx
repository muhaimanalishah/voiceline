"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, Plus, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import AudioRecorder from "./AudioRecorder";
import AskSidePanel from "./AskSidePanel";
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
import { TagWithCount, RecordingItem } from "@/lib/recordings/types";
import { useTagsQuery } from "@/hooks/queries/useTags";
import { useUpdateRecordingMutation } from "@/hooks/queries/useRecordings";
import { queryKeys } from "@/hooks/queries/keys";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import styles from "./VoiceLineHome.module.css";

export default function VoiceLineHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useTagsQuery();
  const updateRecordingMutation = useUpdateRecordingMutation();

  const tags = data?.tags || [];
  const unclassifiedCount = data?.unclassifiedCount || 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isAskPanelOpen, setIsAskPanelOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);

  // Active item during drag & drop
  const [activeDragNote, setActiveDragNote] = useState<RecordingItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleRecordingCreated = (createdId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    router.push(`/notes/${encodeURIComponent(createdId)}`);
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const note = event.active.data.current?.note as RecordingItem | undefined;
    if (note) {
      setActiveDragNote(note);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragNote(null);

    if (!over) return;

    const note = active.data.current?.note as RecordingItem | undefined;
    const sourceTagId = active.data.current?.sourceTagId as string | null | undefined;
    const targetTagId = over.data.current?.tagId as string | null | undefined;
    const targetTagName =
      (over.data.current?.tagName as string) ||
      (targetTagId === null ? "Unclassified" : "tag");

    if (!note || targetTagId === undefined) return;
    if (sourceTagId === targetTagId) return;

    try {
      await updateRecordingMutation.mutateAsync({
        id: note.id,
        tagId: targetTagId,
      });
      toast.success(`Moved note to "${targetTagName}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to move note.";
      toast.error(msg);
    }
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
    if (isAskPanelOpen) setIsAskPanelOpen(false);
  });

  return (
    <div className={styles.page}>
      <div className={styles.mainColumn}>
        <div className={styles.container}>
          <div className={styles.headerRow}>
            <div className={styles.brand}>
              <span className={styles.brandIconWrap}>
                <Mic size={14} />
              </span>
              <span>VoiceLine</span>
            </div>

            <div className={styles.headerActions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTag(true)}
                icon={<Plus size={13} />}
              >
                New tag
              </Button>
              <Button
                variant="icon"
                size="sm"
                onClick={() => setShowManageTags(true)}
                title="Manage tags"
                aria-label="Manage tags"
                icon={<Settings size={14} />}
              />
            </div>
          </div>

          <div className={styles.toolbar}>
            <SearchInput
              ref={searchInputRef}
              placeholder="Search notes..."
              value={searchQuery}
              onChange={setSearchQuery}
              shortcut="Ctrl+K"
            />
          </div>

          <AudioRecorder
            onRecordingCreated={handleRecordingCreated}
            onOpenAsk={() => setIsAskPanelOpen((v) => !v)}
          />

          {isLoading ? (
            <div className={styles.loadingSpinner}>
              <Spinner size="xl" />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
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

              <DragOverlay>
                {activeDragNote ? (
                  <div className={styles.dragOverlayRow}>
                    <div className={styles.dragOverlayTitle}>
                      {activeDragNote.title || "Untitled Note"}
                    </div>
                    <div className={styles.dragOverlayPreview}>
                      {activeDragNote.textPreview || "Empty note"}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          <div className={styles.shortcutBar} onClick={() => setShowShortcuts(true)}>
            <div className={styles.shortcutItem}>
              <Kbd>Ctrl+K</Kbd>
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
      </div>

      <AskSidePanel
        isOpen={isAskPanelOpen}
        onClose={() => setIsAskPanelOpen(false)}
      />

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
