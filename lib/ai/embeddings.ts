import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { isDemoMode } from "@/lib/db/db";

const defaultEmbeddingModel = () =>
  openai.embedding(process.env.EMBEDDING_MODEL || "text-embedding-3-small");

export function generateMockEmbedding(text: string, dimensions = 1536): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const pos = (code * 31 + i * 17) % dimensions;
    vector[pos] += Math.sin(code + i);
    vector[(pos + 13) % dimensions] += Math.cos(code * 7);
  }
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  } else {
    vector[0] = 1;
  }
  return vector;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (isDemoMode || !process.env.OPENAI_API_KEY) {
    return generateMockEmbedding(text);
  }
  try {
    const { embedding } = await embed({
      model: defaultEmbeddingModel(),
      value: text.trim().replace(/\n+/g, " "),
    });
    return embedding;
  } catch {
    return generateMockEmbedding(text);
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (isDemoMode || !process.env.OPENAI_API_KEY) {
    return texts.map((t) => generateMockEmbedding(t));
  }
  try {
    const cleanedTexts = texts.map((t) => t.trim().replace(/\n+/g, " "));
    const { embeddings } = await embedMany({
      model: defaultEmbeddingModel(),
      values: cleanedTexts,
    });
    return embeddings;
  } catch {
    return texts.map((t) => generateMockEmbedding(t));
  }
}

