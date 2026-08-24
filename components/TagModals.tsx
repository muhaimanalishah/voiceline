"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Modal,
  ConfirmDialog,
  Button,
  FormField,
  Input,
  Textarea,
  TagChip,
  TagDot,
  Kbd,
} from "@/components/ui";
import { TagWithCount } from "@/lib/recordings/types";
import {
  TAG_COLORS,
  PRESET_TAGS,
  PresetTag,
  DEFAULT_TAG_COLOR,
} from "@/lib/recordings/constants";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "@/lib/hooks/queries/useTags";
import styles from "./TagModals.module.css";

interface NewTagModalProps {
  onClose: () => void;
}

export function NewTagModal({ onClose }: NewTagModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTagMutation();

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
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        color,
      });
      toast.success(`Tag "${name.trim()}" created successfully!`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create tag.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Modal title="New tag" onClose={onClose}>
      <FormField label="Name" error={error}>
        <Input
          placeholder="e.g. Health"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          rows={2}
          placeholder="Helps the classifier know when to use this tag..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

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
              <TagChip
                key={preset.name}
                name={preset.name}
                color={preset.color}
                active={isSelected}
                onClick={() => handleSelectPreset(preset)}
                title={`Click to fill: ${preset.description}`}
              />
            );
          })}
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={createMutation.isPending}
        >
          Create tag
        </Button>
      </div>
    </Modal>
  );
}

interface RenameTagModalProps {
  tag: TagWithCount;
  onClose: () => void;
}

export function RenameTagModal({ tag, onClose }: RenameTagModalProps) {
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateTagMutation();

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      const msg = "Name and description are required.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: tag.id,
        name: name.trim(),
        description: description.trim(),
      });
      toast.success(`Tag "${name.trim()}" updated successfully!`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update tag.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Modal title="Rename tag" onClose={onClose}>
      <FormField label="Name" error={error}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={updateMutation.isPending}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

interface DeleteTagModalProps {
  tag: TagWithCount;
  onClose: () => void;
}

export function DeleteTagModal({ tag, onClose }: DeleteTagModalProps) {
  const deleteMutation = useDeleteTagMutation();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(tag.id);
      toast.success(`Tag "${tag.name}" deleted.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete tag.";
      toast.error(msg);
    }
  };

  const warnMessage =
    tag.recordingCount > 0
      ? `${tag.recordingCount} note${tag.recordingCount === 1 ? "" : "s"} tagged "${tag.name}". They won't be deleted — they'll move to Unclassified. This can't be undone.`
      : `This tag has no notes. This can't be undone.`;

  return (
    <ConfirmDialog
      title={`Delete "${tag.name}" tag?`}
      description={warnMessage}
      confirmText="Delete tag"
      variant="danger"
      isLoading={deleteMutation.isPending}
      onConfirm={handleDelete}
      onCancel={onClose}
    />
  );
}

interface ManageTagsModalProps {
  tags: TagWithCount[];
  isLoading?: boolean;
  onClose: () => void;
}

export function ManageTagsModal({ tags, isLoading = false, onClose }: ManageTagsModalProps) {
  const [renameTarget, setRenameTarget] = useState<TagWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithCount | null>(null);
  const [showNewTag, setShowNewTag] = useState(false);

  return (
    <>
      <Modal title="Manage tags" onClose={onClose} wide>
        <div className={styles.tagList}>
          {isLoading ? (
            <div className={styles.tagListDesc}>Loading...</div>
          ) : tags.length === 0 ? (
            <div className={styles.tagListDesc}>No tags yet.</div>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className={styles.tagListItem}>
                <TagDot color={tag.color || DEFAULT_TAG_COLOR} size="sm" />
                <div className={styles.tagListMain}>
                  <div className={styles.tagListName}>{tag.name}</div>
                  <div className={styles.tagListDesc}>{tag.description}</div>
                </div>
                <div className={styles.tagListActions}>
                  <Button
                    variant="icon"
                    size="sm"
                    onClick={() => setRenameTarget(tag)}
                    aria-label={`Rename ${tag.name}`}
                    icon={<Pencil size={13} />}
                  />
                  <Button
                    variant="iconDanger"
                    size="sm"
                    onClick={() => setDeleteTarget(tag)}
                    aria-label={`Delete ${tag.name}`}
                    icon={<Trash2 size={13} />}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <button type="button" className={styles.newTagBtn} onClick={() => setShowNewTag(true)}>
          <Plus size={14} />
          <span>New tag</span>
        </button>
      </Modal>

      {showNewTag && (
        <NewTagModal onClose={() => setShowNewTag(false)} />
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
    <Modal title="Keyboard Shortcuts" onClose={onClose}>
      <div className={styles.shortcutsList}>
        {shortcuts.map((s) => (
          <div key={s.key} className={styles.shortcutRow}>
            <span className={styles.shortcutDesc}>{s.desc}</span>
            <Kbd>{s.key}</Kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
