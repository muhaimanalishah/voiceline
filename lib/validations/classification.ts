import { z } from "zod";

export const NoTagsClassificationSchema = z.object({
  title: z
    .string()
    .describe("A concise descriptive title between 3 to 6 words maximum"),
  summary: z
    .array(z.string())
    .describe(
      "2 to 4 concise bullet summary points capturing key takeaways, decisions, or action items"
    ),
});

export function createClassificationSchema(availableTagIds: [string, ...string[]]) {
  return z.object({
    title: z
      .string()
      .describe("A concise descriptive title between 3 to 6 words maximum"),
    tagId: z
      .enum(availableTagIds)
      .describe("The id of the single most appropriate matching tag"),
    summary: z
      .array(z.string())
      .describe(
        "2 to 4 concise bullet summary points capturing key takeaways, decisions, or action items"
      ),
  });
}

export type ClassificationResult = {
  title: string;
  tagId?: string | null;
  summary: string[];
};
