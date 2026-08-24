"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TagWithCount } from "@/lib/recordings/types";
import styles from "./TagModals.module.css";

const TAG_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#71717a"];

interface PresetTag {
  name: string;
  description: string;
  color: string;
}

const PRESET_TAGS: PresetTag[] = [
  {
    name: "Work",
    description: "Tasks, projects, work meetings, and professional updates.",
    color: "#3b82f6",
  },
  {
    name: "Personal",
    description: "Daily thoughts, personal errands, health, and family.",
    color: "#22c55e",
  },
  {
    name: "Ideas",
    description: "Creative thoughts, brainstorms, concepts, and future projects.",
    color: "#a855f7",
  },
  {
    name: "Meeting",
    description: "Action items, meeting summaries, discussions, and decisions.",
    color: "#eab308",
  },
  {
    name: "To-Do",
    description: "Actionable tasks, checklists, and immediate follow-ups.",
    color: "#ef4444",
  },
];

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

  const handleSelectPreset = (preset: PresetTag) => {
    setName(preset.name);
    setDescription(preset.description);
    setColor(preset.color);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      const msg = "Name and description are required.";
      setError(msg);
      toast.error(msg);
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
      toast.success(`Tag "${name.trim()}" created successfully!`);
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create tag.";
      setError(msg);
      toast.error(msg);
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

        <div className={styles.field}>
          <label className={styles.label}>Suggestions</label>
          <div className={styles.presetList}>
            {PRESET_TAGS.map((preset) => {
              const isSelected =
                name === preset.name &&
                description === preset.description &&
                color === preset.color;

              return (
                <button
                  key={preset.name}
                  type="button"
                  className={`${styles.presetChip} ${isSelected ? styles.presetChipActive : ""}`}
                  onClick={() => handleSelectPreset(preset)}
                  title={`Click to fill: ${preset.description}`}
                >
                  <span
                    className={styles.presetChipDot}
                    style={{ background: preset.color }}
                  />
                  <span>{preset.name}</span>
                </button>
              );
            })}
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
      const msg = "Name and description are required.";
      setError(msg);
      toast.error(msg);
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
      toast.success(`Tag "${name.trim()}" updated successfully!`);
      onUpdated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update tag.";
      setError(msg);
      toast.error(msg);
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
      toast.success(`Tag "${tag.name}" deleted.`);
      onDeleted();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete tag.";
      setError(msg);
      toast.error(msg);
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
  tags: TagWithCount[];
  isLoading?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ManageTagsModal({ tags, isLoading = false, onClose, onChanged }: ManageTagsModalProps) {
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);
  const [showNewTag, setShowNewTag] = useState(false);

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
        <NewTagModal onClose={() => setShowNewTag(false)} onCreated={onChanged} />
      )}
      {renameTarget && (
        <RenameTagModal
          tag={renameTarget}
          onClose={() => setRenameTarget(null)}
          onUpdated={onChanged}
        />
      )}
      {deleteTarget && (
        <DeleteTagModal
          tag={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onChanged}
        />
      )}
    </>
  );
}
export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: "Cmd + K", desc: "Focus search bar" },
    { key: "Alt + N", desc: "Scroll to recorder" },
    { key: "Ctrl + S", desc: "Save transcript edits" },
    { key: "Alt + C", desc: "Copy active transcript" },
    { key: "?", desc: "Toggle keyboard shortcuts" },
    { key: "Esc", desc: "Close modal / drawer" },
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Keyboard Shortcuts</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.shortcutsList}>
          {shortcuts.map((s) => (
            <div key={s.key} className={styles.shortcutRow}>
              <span className={styles.shortcutDesc}>{s.desc}</span>
              <span className={styles.shortcutKey}>{s.key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
