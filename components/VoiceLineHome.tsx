"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic, Search, Plus, Settings, Loader2 } from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import TagGroup from "./TagGroup";
import { NewTagModal, RenameTagModal, DeleteTagModal, ManageTagsModal } from "./TagModals";
import { TagWithCount } from "@/lib/recordings/types";
import styles from "./VoiceLineHome.module.css";

export default function VoiceLineHome() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showNewTag, setShowNewTag] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);

  // Re-mounts all TagGroup components to refetch after mutations (create/rename/delete/new recording)
  const [refreshKey, setRefreshKey] = useState(0);

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
    let ignore = false;
    const load = async () => {
      try {
        const res = await fetch("/api/tags");
        const data = await res.json();
        if (!ignore && res.ok) {
          setTags(data.tags || []);
          setUnclassifiedCount(data.unclassifiedCount || 0);
        }
      } catch (err) {
        console.error("Failed to load tags:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleDataChanged = () => {
    loadTags();
    setRefreshKey((k) => k + 1);
  };

  const handleRecordingCreated = () => {
    handleDataChanged();
  };

  // Alt+N focuses the recorder area by scrolling to top
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
              type="text"
              className={styles.searchInput}
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
          <div className={styles.groupsList} key={refreshKey}>
            <TagGroup
              tagId={null}
              name="Unclassified"
              description="no tag assigned yet"
              totalCount={unclassifiedCount}
              defaultOpen
            />

            {tags.map((tag) => (
              <TagGroup
                key={tag.id}
                tagId={tag.id}
                name={tag.name}
                description={tag.description}
                color={tag.color}
                totalCount={tag.recordingCount}
                onRename={() => setRenameTarget(tag)}
                onDelete={() => setDeleteTarget(tag)}
              />
            ))}
          </div>
        )}

        <div className={styles.shortcutBar}>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Alt+N</span>
            <span>New</span>
          </div>
          <span className={styles.dividerDot}>•</span>
          <div className={styles.shortcutItem}>
            <span className={styles.kbd}>Ctrl+S</span>
            <span>Save</span>
          </div>
        </div>
      </div>

      {showNewTag && (
        <NewTagModal onClose={() => setShowNewTag(false)} onCreated={handleDataChanged} />
      )}
      {showManageTags && (
        <ManageTagsModal onClose={() => setShowManageTags(false)} onChanged={handleDataChanged} />
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
