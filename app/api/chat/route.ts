// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  UIMessage,
} from "ai";
import { recordingStore } from "@/lib/recordings";
import { HybridSearchResult } from "@/lib/recordings/types";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { isDemoMode } from "@/lib/db/db";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const isMock = isDemoMode || !apiKey;

  // 1. Extract latest user query text
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      ?.map((p) => (p as { text: string }).text)
      ?.join(" ") || "";

  let contextString = "No matching voice notes found.";
  let matchedChunks: HybridSearchResult[] = [];

  // 2. Perform Hybrid Search (Dense vector + Sparse keyword RRF)
  if (queryText.trim()) {
    try {
      const queryEmbedding = await generateEmbedding(queryText);
      const results = await recordingStore.hybridSearchNotes?.({
        queryText,
        queryEmbedding,
        limit: 5,
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

  // 3. Demo Mode / Mock Streaming Response
  if (isMock) {
    let responseText = "";

    if (matchedChunks.length > 0) {
      const topMatches = matchedChunks.slice(0, 3);
      const notesList = topMatches
        .map(
          (m) =>
            `• **${m.title || "Voice Note"}** (${m.tagName || "Unclassified"}):\n  ${m.chunkContent.slice(0, 180)}...`
        )
        .join("\n\n");

      responseText = `Based on your voice notes, here is what I found regarding **"${queryText}"**:\n\n${notesList}\n\nYou can click on any of the referenced note cards below to inspect the full transcript and details.`;
    } else {
      responseText = `I searched your voice notes for **"${queryText}"**, but couldn't find a direct match.\n\nHere are some topics you can ask me about in this demo:\n• **Backend Team Meeting Notes** (Audio blob offloading, rate limiting)\n• **Q3 Voice Architecture Roadmap** (Hybrid search & local SQLite)\n• **Lake Tahoe Trip Checklist** (Cabin door code & supplies)\n• **Atomic Habits** (1% rule & habit loops)`;
    }

    const words = responseText.split(/(?<=\s+)/);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "start",
          messageMetadata: {
            matchedNotes: matchedChunks,
          },
        });
        writer.write({ type: "text-start", id: "demo-msg-1" });

        for (const word of words) {
          writer.write({ type: "text-delta", id: "demo-msg-1", delta: word });
          await new Promise((r) => setTimeout(r, 20));
        }

        writer.write({ type: "text-end", id: "demo-msg-1" });
        writer.write({ type: "finish" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  // 4. Production OpenAI Streaming Response
  const modelMessages = await convertToModelMessages(messages);
  const systemPrompt = `You are VoiceLine AI, a helpful personal assistant answering questions about the user's voice notes.
Use the following retrieved notes context to answer the user's question accurately.
When referencing information from a note, cite its title or date naturally.
If the notes do not contain the answer, answer generally or let the user know no relevant notes were found.

User's Relevant Notes Context:
${contextString}`;

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