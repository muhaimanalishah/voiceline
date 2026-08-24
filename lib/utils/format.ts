/**
 * Formats a date string into a relative or short display string:
 * - If today: returns time e.g. "2:30 PM"
 * - If earlier: returns short date e.g. "Aug 24"
 */
export function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

/**
 * Formats a date string into a full readable date & time string:
 * e.g. "Aug 24, 2026, 1:45 PM"
 */
export function formatFullDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/**
 * Converts a string into proper English Title Case.
 */
export function toTitleCase(str: string): string {
  if (!str) return "";
  const minorWords = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "with", "in", "of"
  ]);

  return str
    .trim()
    .replace(/^["'`]|["'`]$/g, "") // strip wrapping quotes
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && minorWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Checks if a note's title is a default placeholder or matches the note ID.
 */
export function isDefaultTitle(title: string | null | undefined, noteId: string): boolean {
  if (!title) return true;
  const t = title.trim();
  return (
    t === "" ||
    t.toLowerCase() === "untitled note" ||
    t === noteId ||
    /^Voice Note\s*-\s*/i.test(t)
  );
}

