"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, Search, Plus, Settings, Loader2 } from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import TagGroup from "./TagGroup";
import {
  NewTagModal,
  RenameTagModal,
  DeleteTagModal,
  ManageTagsModal,
  ShortcutsModal,
} from "./TagModals";
import { TagWithCount } from "@/lib/recordings/types";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import styles from "./VoiceLineHome.module.css";

export default function VoiceLineHome() {
  const router = useRouter();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showNewTag, setShowNewTag] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);

  // Trigger to refetch opened TagGroup components after mutations without unmounting
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (res.ok) {
        setTags(data.tags || []);
        setUnclassifiedCount(data.unclassifiedCount || 0);
      }
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleDataChanged = () => {
    loadTags();
    setRefreshTrigger((k) => k + 1);
  };

  const handleRecordingCreated = (createdId: string) => {
    handleDataChanged();
    // Navigate directly to the full note page
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
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search notes or transcripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className={styles.searchShortcutHint}>⌘K</span>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => setShowNewTag(true)}>
            <Plus size={14} />
            <span>New tag</span>
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnSquare}`}
            onClick={() => setShowManageTags(true)}
            title="Manage tags"
            aria-label="Manage tags"
          >
            <Settings size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loadingSpinner}>
            <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <div className={styles.groupsList}>
            <TagGroup
              tagId={null}
              name="Unclassified"
              description="no tag assigned yet"
              totalCount={unclassifiedCount}
              defaultOpen
              refreshTrigger={refreshTrigger}
              searchQuery={searchQuery}
              onNoteChanged={handleDataChanged}
            />

            {tags.map((tag) => (
              <TagGroup
                key={tag.id}
                tagId={tag.id}
                name={tag.name}
                description={tag.description}
                color={tag.color}
                totalCount={tag.recordingCount}
                refreshTrigger={refreshTrigger}
                searchQuery={searchQuery}
                onNoteChanged={handleDataChanged}
                onRename={() => setRenameTarget(tag)}
                onDelete={() => setDeleteTarget(tag)}
              />
            ))}
          </div>
        )}

        <div className={styles.shortcutBar} onClick={() => setShowShortcuts(true)}>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>⌘K</span>
            <span>Search</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Alt+N</span>
            <span>Record</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>?</span>
            <span>Shortcuts</span>
          </div>
        </div>
      </div>

      {showNewTag && (
        <NewTagModal onClose={() => setShowNewTag(false)} onCreated={handleDataChanged} />
      )}
      {showManageTags && (
        <ManageTagsModal
          tags={tags}
          isLoading={isLoading}
          onClose={() => setShowManageTags(false)}
          onChanged={handleDataChanged}
        />
      )}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
      {renameTarget && (
        <RenameTagModal
          tag={renameTarget}
          onClose={() => setRenameTarget(null)}
          onUpdated={handleDataChanged}
        />
      )}
      {deleteTarget && (
        <DeleteTagModal
          tag={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDataChanged}
        />
      )}
    </div>
  );
}
