import { db } from "../lib/db/db";
import { recordings } from "../lib/db/schema";
import { isNull, eq } from "drizzle-orm";
import { generateEmbedding } from "../lib/ai/embeddings";

async function backfill() {
  if (!db) throw new Error("Database not connected");

  const unindexed = await db
    .select({
      id: recordings.id,
      title: recordings.title,
      text: recordings.transcript,
      rawTranscript: recordings.rawTranscript,
      summary: recordings.summary,
      tagId: recordings.tagId,
    })
    .from(recordings)
    .where(isNull(recordings.embedding));

  console.log(`Found ${unindexed.length} notes without embeddings.`);

  for (const note of unindexed) {
    const activeText = note.text || note.rawTranscript;
    const parsedSummary: string[] | null = note.summary
      ? JSON.parse(note.summary)
      : null;

    const textToEmbed = [
      `Title: ${note.title || note.id}`,
      parsedSummary?.length ? `Summary:\n${parsedSummary.join("\n")}` : null,
      `Content:\n${activeText}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const embedding = await generateEmbedding(textToEmbed);

    await db
      .update(recordings)
      .set({ embedding })
      .where(eq(recordings.id, note.id));

    console.log(`Indexed note: ${note.title || note.id}`);
  }

  console.log("Backfill complete!");
  process.exit(0);
}

backfill().catch(console.error);