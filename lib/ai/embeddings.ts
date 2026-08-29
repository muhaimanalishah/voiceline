import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const defaultEmbeddingModel = () =>
  openai.embedding(process.env.EMBEDDING_MODEL || "text-embedding-3-small");

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: defaultEmbeddingModel(),
    value: text.trim().replace(/\n+/g, " "),
  });
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const cleanedTexts = texts.map((t) => t.trim().replace(/\n+/g, " "));
  const { embeddings } = await embedMany({
    model: defaultEmbeddingModel(),
    values: cleanedTexts,
  });
  return embeddings;
}

