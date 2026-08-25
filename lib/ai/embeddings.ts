import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(
      process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    ),
    value: text.trim().replace(/\n+/g, " "),
  });
  return embedding;
}
