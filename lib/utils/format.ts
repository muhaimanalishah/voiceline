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
