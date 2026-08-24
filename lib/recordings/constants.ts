export const TAG_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#eab308",
  "#22c55e",
  "#a855f7",
  "#71717a",
] as const;

export const DEFAULT_TAG_COLOR = "#71717a";

export interface PresetTag {
  name: string;
  description: string;
  color: string;
}

export const PRESET_TAGS: PresetTag[] = [
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
