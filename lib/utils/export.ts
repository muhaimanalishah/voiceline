export interface ExportNoteOptions {
  title?: string | null;
  text: string;
  createdAt: string;
  model?: string | null;
}

/**
 * Exports a note transcript as a formatted Markdown file download.
 */
export function exportNoteAsMarkdown(options: ExportNoteOptions): void {
  const { title, text, createdAt, model } = options;
  const displayTitle = title || "Untitled Note";

  const sanitizedTitle = displayTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "transcript";

  const dateStr = new Date(createdAt).toISOString().split("T")[0];
  const filename = `${sanitizedTitle}-${dateStr}.md`;

  const markdownContent = [
    `# ${displayTitle}`,
    "",
    `- **Date:** ${new Date(createdAt).toLocaleString()}`,
    model ? `- **Model:** ${model}` : null,
    "",
    "---",
    "",
    text,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
