import { z } from "zod";

export const NoTagsClassificationSchema = z.object({
  translatedText: z
    .string()
    .describe(
      "The full voice note transcript translated/converted into natural, clear English. Preserve exact meaning, tone, colloquial flow, and structure without omitting or fabricating information. If already in English, keep it in English."
    ),
  title: z
    .string()
    .describe("A concise descriptive English title between 3 to 6 words maximum"),
  summary: z
    .array(z.string())
    .describe(
      "2 to 4 concise bullet summary points in English capturing key takeaways, decisions, or action items"
    ),
});

export function createClassificationSchema(availableTagIds: [string, ...string[]]) {
  return z.object({
    translatedText: z
      .string()
      .describe(
        "The full voice note transcript translated/converted into natural, clear English. Preserve exact meaning, tone, colloquial flow, and structure without omitting or fabricating information. If already in English, keep it in English."
      ),
    title: z
      .string()
      .describe("A concise descriptive English title between 3 to 6 words maximum"),
    tagId: z
      .enum(availableTagIds)
      .describe("The id of the single most appropriate matching tag from available tags"),
    summary: z
      .array(z.string())
      .describe(
        "2 to 4 concise bullet summary points in English capturing key takeaways, decisions, or action items"
      ),
  });
}

export type ClassificationResult = {
  translatedText: string;
  title: string;
  tagId?: string | null;
  summary: string[];
};
