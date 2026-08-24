"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { TagWithCount } from "@/lib/recordings/types";
import styles from "./TagModals.module.css";

const TAG_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#71717a"];

interface NewTagModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewTagModal({ onClose, onCreated }: NewTagModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tag.");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>New tag</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {error && <div className={styles.errorText}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            className={styles.input}
            placeholder="e.g. Health"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            rows={2}
            className={styles.textarea}
            placeholder="Helps the classifier know when to use this tag..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorRow}>
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create tag"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RenameTagModalProps {
  tag: TagWithCount;
  onClose: () => void;
  onUpdated: () => void;
}

export function RenameTagModal({ tag, onClose, onUpdated }: RenameTagModalProps) {
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tag.");
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tag.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Rename tag</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {error && <div className={styles.errorText}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            rows={2}
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteTagModalProps {
  tag: TagWithCount;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTagModal({ tag, onClose, onDeleted }: DeleteTagModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete tag.");
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.warnBox}>
          <div className={styles.warnIcon}>
            <AlertTriangle size={16} />
          </div>
          <span className={styles.title}>Delete &quot;{tag.name}&quot; tag?</span>
        </div>

        {error && <div className={styles.errorText}>{error}</div>}

        <p className={styles.warnText}>
          {tag.recordingCount > 0
            ? `${tag.recordingCount} note${tag.recordingCount === 1 ? "" : "s"} tagged "${tag.name}". They won't be deleted — they'll move to Unclassified. This can't be undone.`
            : `This tag has no notes. This can't be undone.`}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete tag"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ManageTagsModalProps {
  onClose: () => void;
  onChanged: () => void;
}

export function ManageTagsModal({ onClose, onChanged }: ManageTagsModalProps) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);
  const [showNewTag, setShowNewTag] = useState(false);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (res.ok) setTags(data.tags || []);
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/tags");
        const data = await res.json();
        if (!ignore && res.ok) setTags(data.tags || []);
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

  const handleChanged = () => {
    loadTags();
    onChanged();
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose}>
        <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>Manage tags</span>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.tagList}>
            {isLoading ? (
              <div className={styles.tagListDesc}>Loading...</div>
            ) : tags.length === 0 ? (
              <div className={styles.tagListDesc}>No tags yet.</div>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className={styles.tagListItem}>
                  <span className={styles.tagListDot} style={{ background: tag.color || "#71717a" }} />
                  <div className={styles.tagListMain}>
                    <div className={styles.tagListName}>{tag.name}</div>
                    <div className={styles.tagListDesc}>{tag.description}</div>
                  </div>
                  <div className={styles.tagListActions}>
                    <button
                      type="button"
                      className={styles.tagListIconBtn}
                      onClick={() => setRenameTarget(tag)}
                      aria-label={`Rename ${tag.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.tagListIconBtn} ${styles.tagListIconBtnDanger}`}
                      onClick={() => setDeleteTarget(tag)}
                      aria-label={`Delete ${tag.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button type="button" className={styles.newTagBtn} onClick={() => setShowNewTag(true)}>
            <Plus size={14} />
            New tag
          </button>
        </div>
      </div>

      {showNewTag && (
        <NewTagModal onClose={() => setShowNewTag(false)} onCreated={handleChanged} />
      )}
      {renameTarget && (
        <RenameTagModal
          tag={renameTarget}
          onClose={() => setRenameTarget(null)}
          onUpdated={handleChanged}
        />
      )}
      {deleteTarget && (
        <DeleteTagModal
          tag={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleChanged}
        />
      )}
    </>
  );
}
