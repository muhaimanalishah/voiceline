import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  buildProcessSchemaAndPrompt,
  ProcessedNoteResult,
} from "./prompts/process";
import { toTitleCase, isDefaultTitle } from "@/lib/utils/format";
import { TagItem } from "@/lib/recordings/types";
import { generateEmbedding, generateEmbeddings } from "./embeddings";
import { chunkVoiceNote } from "./chunking";

export async function generateProcessedNote<T extends z.ZodTypeAny>({
  schema,
  systemPrompt,
  rawTranscript,
}: {
  schema: T;
  systemPrompt: string;
  rawTranscript: string;
}) {
  const processingModel =
    process.env.PROCESSING_MODEL ||
    process.env.OPENAI_PROCESSING_MODEL ||
    "gpt-4o-mini";

  const { output } = await generateText({
    model: openai(processingModel),
    output: Output.object({ schema }),
    temperature: 0.2,
    instructions: systemPrompt,
    prompt: rawTranscript,
  });

  return output;
}

export async function processVoiceNote({
  rawTranscript,
  noteId,
  currentTitle,
  currentTagId,
  currentSummary,
  availableTags = [],
}: {
  rawTranscript: string;
  noteId: string;
  currentTitle?: string | null;
  currentTagId?: string | null;
  currentSummary?: string[] | null;
  availableTags?: TagItem[];
}) {
  const wordCount = rawTranscript.split(/\s+/).filter(Boolean).length;
  const needsTitle = isDefaultTitle(currentTitle, noteId);
  const needsSummary = wordCount >= 500;
  const needsTag = !currentTagId && availableTags.length > 0;

  const { schema, systemPrompt } = buildProcessSchemaAndPrompt({
    needsTitle,
    needsSummary,
    needsTag,
    availableTags,
  });

  const parsed = (await generateProcessedNote({
    schema,
    systemPrompt,
    rawTranscript,
  })) as ProcessedNoteResult;

  const cleanText = parsed.cleanText?.trim() || rawTranscript;
  const title =
    needsTitle && parsed.title?.trim()
      ? toTitleCase(parsed.title)
      : currentTitle || noteId;
  const summary =
    needsSummary && parsed.summary ? parsed.summary : currentSummary || null;
  const tagId =
    needsTag && parsed.tagId ? parsed.tagId : (currentTagId ?? null);

  const matchedTag = tagId
    ? availableTags.find((t) => t.id === tagId) || null
    : null;

  // Build semantic payload and compute document-level vector embedding
  const textToEmbed = [
    `Title: ${title}`,
    matchedTag ? `Tag: ${matchedTag.name}` : null,
    summary && summary.length > 0 ? `Summary:\n${summary.join("\n")}` : null,
    `Content:\n${cleanText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const embedding = await generateEmbedding(textToEmbed);

  // Generate granular passage chunks for long-note precision
  const chunks = chunkVoiceNote({
    content: cleanText,
    title,
    tagName: matchedTag?.name ?? null,
  });

  // Batch compute embeddings for all chunks in a single call
  const chunkEmbeddings = await generateEmbeddings(
    chunks.map((c) => c.embeddingText)
  );

  const processedChunks = chunks.map((chunk, index) => ({
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    embedding: chunkEmbeddings[index],
  }));

  return {
    cleanText,
    title,
    summary,
    tagId,
    tagName: matchedTag?.name ?? null,
    embedding,
    chunks: processedChunks,
  };
}
