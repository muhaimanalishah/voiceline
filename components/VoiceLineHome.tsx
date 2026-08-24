"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Search, Plus, Settings, Loader2, HelpCircle } from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import TagGroup from "./TagGroup";
import TranscriptEditor from "./TranscriptEditor";
import { NewTagModal, RenameTagModal, DeleteTagModal, ManageTagsModal, ShortcutsModal } from "./TagModals";
import { TagWithCount, RecordingDetail, RecordingItem } from "@/lib/recordings/types";
import styles from "./VoiceLineHome.module.css";

export default function VoiceLineHome() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showNewTag, setShowNewTag] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);

  // Active note detail for slide-over drawer
  const [activeNote, setActiveNote] = useState<RecordingDetail | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);

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
    // Open the newly recorded note in drawer
    handleSelectNote({ id: createdId } as RecordingItem);
  };

  const handleSelectNote = async (item: RecordingItem) => {
    setIsLoadingNote(true);
    try {
      const res = await fetch(`/api/recordings/${encodeURIComponent(item.id)}`);
      const data = await res.json();
      if (res.ok && data.recording) {
        setActiveNote(data.recording);
      }
    } catch (err) {
      console.error("Failed to load note detail:", err);
    } finally {
      setIsLoadingNote(false);
    }
  };

  const handleUpdateNote = async (id: string, newText: string, newTitle?: string) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText, title: newTitle }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to update transcription.");
    }

    if (activeNote && activeNote.id === id) {
      setActiveNote({
        ...activeNote,
        text: newText,
        title: newTitle || activeNote.title,
      });
    }

    handleDataChanged();
  };

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to delete recording.");
    }

    setActiveNote(null);
    handleDataChanged();
  };

  // Keyboard Shortcuts: Cmd+K / Ctrl+K, Alt+N, ?, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Search: Cmd+K / Ctrl+K or / (when not typing in an input)
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Alt+N: scroll to recorder
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // ?: Toggle keyboard shortcuts helper (when not typing)
      if (e.key === "?" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Esc: Close active drawer or modals
      if (e.key === "Escape") {
        if (activeNote) setActiveNote(null);
        if (showShortcuts) setShowShortcuts(false);
        if (showNewTag) setShowNewTag(false);
        if (showManageTags) setShowManageTags(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNote, showShortcuts, showNewTag, showManageTags]);

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
              activeNoteId={activeNote?.id}
              onSelectNote={handleSelectNote}
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
                activeNoteId={activeNote?.id}
                onSelectNote={handleSelectNote}
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

      {/* Quick Slide-Over Note Drawer */}
      {activeNote && (
        <div className={styles.drawerBackdrop} onClick={() => setActiveNote(null)}>
          <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
            <TranscriptEditor
              recording={activeNote}
              inDrawer
              onClose={() => setActiveNote(null)}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
            />
          </div>
        </div>
      )}

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
