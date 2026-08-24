import { z } from "zod";

export interface TagInfo {
  id: string;
  name: string;
  description: string;
}

export interface BuildProcessSchemaParams {
  needsTitle: boolean;
  needsSummary: boolean;
  needsTag: boolean;
  availableTags?: TagInfo[];
}

export function buildProcessSchemaAndPrompt({
  needsTitle,
  needsSummary,
  needsTag,
  availableTags = [],
}: BuildProcessSchemaParams) {
  // 1. Construct dynamic Zod schema
  const shape: Record<string, z.ZodTypeAny> = {
    cleanText: z
      .string()
      .describe(
        "The polished voice note. If already in English, strictly clean speech stutters/fillers while preserving exact structure, phrasing, and thoughts without rewriting or summarizing. If non-English or mixed, translate into natural, fluent English while preserving full meaning, tone, and first-person voice."
      ),
  };

  if (needsTitle) {
    shape.title = z
      .string()
      .describe("A concise, descriptive title capturing the main subject.");
  }

  if (needsSummary) {
    shape.summary = z
      .array(z.string())
      .describe("2 to 3 concise bullet points capturing key takeaways or action items.");
  }

  if (needsTag && availableTags.length > 0) {
    const tagIds = availableTags.map((t) => t.id) as [string, ...string[]];
    shape.tagId = z
      .enum(tagIds)
      .describe("The ID of the single best matching tag from the available tags list.");
  }

  const schema = z.object(shape);

  // 2. Construct dynamic System Prompt
  const tasks: string[] = [
    [
      "1. **Clean Text (`cleanText`)**:",
      "   - **If the transcript is in a non-English language or contains mixed languages (code-switching)**: Translate and convert the entire transcript into natural, clear, and fluent English.",
      "   - **If the transcript is already in English**: Do NOT rewrite, summarize, or alter the sentence structure, vocabulary, or the speaker's ideas. Strictly polish speech artifacts by removing stutters, filler words (e.g., 'um', 'uh', 'like', 'you know'), repetitive false starts, and transcription glitches while preserving 100% of the original voice, phrasing, and flow.",
      "   - **Strict Rule**: Always preserve the first-person perspective, tone, and nuance. Never fabricate extra facts or omit spoken points.",
    ].join("\n"),
  ];

  if (needsTitle) {
    tasks.push(
      "2. **Title (`title`)**:\n   - Write a concise, descriptive title for the note capturing the core topic."
    );
  }

  if (needsSummary) {
    tasks.push(
      "3. **Key Summary Points (`summary`)**:\n   - Provide 2 to 3 concise, high-value bullet points in English capturing core takeaways, decisions, or action items."
    );
  }

  if (needsTag && availableTags.length > 0) {
    const tagList = availableTags
      .map((t) => `   - ID "${t.id}" (${t.name}): ${t.description}`)
      .join("\n");

    tasks.push(
      `4. **Tag Assignment (\`tagId\`)**:\n   - Choose the ID of the single tag whose description best matches the content and context of the note:\n${tagList}`
    );
  }

  const systemPrompt = [
    "You are an expert voice note editor and translator.",
    "Process the user's transcript into structured output by performing the following tasks:",
    ...tasks,
  ].join("\n\n");

  return {
    schema,
    systemPrompt,
  };
}

