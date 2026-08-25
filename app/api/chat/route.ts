// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  UIMessage,
} from "ai";
import { db } from "@/lib/db/db";
import { recordings, tags } from "@/lib/db/schema";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { cosineDistance, desc, eq, isNotNull, sql } from "drizzle-orm";

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

  // 2. Perform vector similarity search if database and query are available
  if (db && queryText.trim()) {
    try {
      const queryEmbedding = await generateEmbedding(queryText);
      const similarity = sql<number>`1 - (${cosineDistance(recordings.embedding, queryEmbedding)})`;

      const matchedNotes = await db
        .select({
          id: recordings.id,
          title: recordings.title,
          text: recordings.transcript,
          rawTranscript: recordings.rawTranscript,
          summary: recordings.summary,
          tagName: tags.name,
          createdAt: recordings.createdAt,
          similarity,
        })
        .from(recordings)
        .leftJoin(tags, eq(recordings.tagId, tags.id))
        .where(isNotNull(recordings.embedding))
        .orderBy(desc(similarity))
        .limit(4);

      // Filter by confidence threshold (> 0.35)
      const relevantNotes = matchedNotes.filter((n) => n.similarity > 0.35);

      if (relevantNotes.length > 0) {
        contextString = relevantNotes
          .map((n) => {
            const body = n.text || n.rawTranscript;
            return `[Note ID: ${n.id} | Title: "${n.title || "Untitled"}" | Tag: ${
              n.tagName || "Unclassified"
            } | Date: ${n.createdAt}]\n${body}`;
          })
          .join("\n\n---\n\n");
      }
    } catch (err) {
      console.error("RAG retrieval error:", err);
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
    }),
  });
}