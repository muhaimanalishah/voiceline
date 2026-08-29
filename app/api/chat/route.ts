// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  UIMessage,
} from "ai";
import { recordingStore } from "@/lib/recordings";
import { HybridSearchResult } from "@/lib/recordings/types";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { db } from "@/lib/db/db";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  // 1. Extract latest user query text
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      ?.map((p) => (p as { text: string }).text)
      ?.join(" ") || "";

  let contextString = "No matching voice notes found.";
  let matchedChunks: HybridSearchResult[] = [];

  // 2. Perform Hybrid Search (Dense pgvector + Full-Text RRF)
  if (db && queryText.trim()) {
    try {
      const queryEmbedding = await generateEmbedding(queryText);
      const results = await recordingStore.hybridSearchNotes?.({
        queryText,
        queryEmbedding,
        limit: 6,
      });

      if (results && results.length > 0) {
        matchedChunks = results;
        contextString = matchedChunks
          .map((chunk) => {
            const sectionLabel =
              chunk.chunkIndex > 0 ? ` (Section ${chunk.chunkIndex + 1})` : "";
            return `[Note ID: ${chunk.id} | Title: "${chunk.title || "Untitled"}"${sectionLabel} | Tag: ${
              chunk.tagName || "Unclassified"
            } | Date: ${chunk.createdAt}]\n${chunk.chunkContent}`;
          })
          .join("\n\n---\n\n");
      }
    } catch (err) {
      console.error("Hybrid RAG retrieval error:", err);
    }
  }

  const systemPrompt = `You are VoiceLine AI, a helpful personal assistant answering questions about the user's voice notes.
Use the following retrieved notes context to answer the user's question accurately.
When referencing information from a note, cite its title or date naturally.
If the notes do not contain the answer, answer generally or let the user know no relevant notes were found.

User's Relevant Notes Context:
${contextString}`;

  // 3. Stream completion
  const result = streamText({
    model: openai(process.env.CHAT_MODEL ?? "gpt-4o-mini"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      messageMetadata: () => ({
        matchedNotes: matchedChunks,
      }),
    }),
  });
}