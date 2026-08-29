import { chunkVoiceNote } from "@/lib/ai/chunking";
import { generateEmbedding, generateEmbeddings } from "@/lib/ai/embeddings";

export interface DemoTagSeed {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface DemoNoteSeed {
  id: string;
  tagId: string | null;
  tagName?: string;
  title: string;
  transcript: string;
  rawTranscript: string;
  summary?: string[] | null;
  duration: number;
  createdAt: string;
}

export const DEMO_TAGS: DemoTagSeed[] = [
  {
    id: "tag-work",
    name: "Work",
    description: "Tasks, projects, work meetings, and professional updates.",
    color: "#3b82f6",
  },
  {
    id: "tag-ideas",
    name: "Ideas",
    description: "Creative thoughts, brainstorms, concepts, and future projects.",
    color: "#a855f7",
  },
  {
    id: "tag-personal",
    name: "Personal",
    description: "Daily thoughts, personal errands, health, and family.",
    color: "#10b981",
  },
];

export const DEMO_NOTES: DemoNoteSeed[] = [
  {
    id: "demo-note-001",
    tagId: "tag-work",
    tagName: "Work",
    title: "Backend Team Meeting Notes",
    transcript:
      "Meeting notes with the backend team:\n\n1. Storage Architecture: We agreed to migrate the recordings table away from storing audio blobs entirely and just keep transcripts going forward since storage costs were getting out of hand.\n\n2. Rate Limiting: James is going to look into rate limiting on the transcribe endpoint because we had a traffic spike last week that looked like abuse.\n\n3. Database & Migrations: Sarah mentioned we should support SQLite locally for quick dev spinning while keeping Postgres for production.\n\nWe will revisit these action items in the next engineering sync on Thursday.",
    rawTranscript:
      "Um so meeting notes with the backend team basically... we agreed to migrate the recordings table away from storing audio blobs entirely and just keep transcripts going forward since storage costs were kind of getting out of hand you know. Also, um, James is going to look into rate limiting on the transcribe endpoint because we had a spike last week that looked like abuse. We will revisit in the next sync.",
    summary: [
      "Migrate recordings away from storing audio blobs to reduce storage costs",
      "Implement rate limiting on the transcribe endpoint to prevent abuse",
      "Follow up on action items in Thursday's sync",
    ],
    duration: 52,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "demo-note-002",
    tagId: "tag-work",
    tagName: "Work",
    title: "Q3 Voice Architecture Roadmap",
    transcript:
      "Sprint planning and architectural roadmap for Q3:\n\n- Hybrid RAG Search: Combine dense embeddings with sparse full-text keyword search using Reciprocal Rank Fusion (RRF) for sub-second note retrieval.\n- Long Note Granularity: Automatically chunk long transcripts exceeding 200 words so paragraph-level citations are precise in Voiceline AI.\n- Mobile UX Overhaul: Transition the recorder dock to an in-flow mobile drawer dock with independent middle viewport scrolling.",
    rawTranscript:
      "Alright so sprint planning and architectural roadmap for Q3. Number one, hybrid RAG search combining dense embeddings with sparse full text keyword search using reciprocal rank fusion. Number two, long note granularity by chunking long transcripts. And number three, mobile UX overhaul for the recorder dock.",
    summary: [
      "Deploy dense + sparse Hybrid Search with Reciprocal Rank Fusion",
      "Chunk long notes exceeding 200 words for precise AI retrieval",
      "Improve mobile drawer dock responsiveness",
    ],
    duration: 68,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "demo-note-003",
    tagId: "tag-ideas",
    tagName: "Ideas",
    title: "AI Voice Agent for Local LLMs",
    transcript:
      "Idea for a native desktop voice companion:\n\nConnect local speech-to-text models like Whisper.cpp with local LLMs (Ollama / Llama 3) running on device. The user can press a global hotkey, speak a quick idea or question, and receive instant synthesized speech feedback without any audio leaving their laptop. Could be bundled as an open-source Electron or Tauri sidecar utility.",
    rawTranscript:
      "Hey quick idea for a native desktop voice companion. What if we connect local speech to text like Whisper.cpp with local LLMs like Ollama running on device? Press a global hotkey, speak an idea, get instant feedback with zero cloud dependency.",
    summary: [
      "Local voice agent using Whisper.cpp and Ollama",
      "Zero cloud latency and privacy-first local processing",
      "Tauri or Electron desktop sidecar architecture",
    ],
    duration: 44,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "demo-note-004",
    tagId: "tag-ideas",
    tagName: "Ideas",
    title: "Graph-Based Note Linking Concept",
    transcript:
      "Concept for automatic graph linking in Voiceline:\n\nWhenever a new voice note is transcribed and processed, the AI can detect cross-references to existing notes, people, projects, and tags. It creates bi-directional markdown links `[[Note Title]]` automatically and renders an interactive knowledge graph of connected audio memories.",
    rawTranscript:
      "Thinking about graph based thought linking for our voice notes. When notes are transcribed, the AI detects cross references to existing notes and creates bi-directional wiki links automatically.",
    summary: [
      "Automatic bi-directional markdown wiki links across voice notes",
      "Interactive knowledge graph visualization of connected thoughts",
    ],
    duration: 38,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
  {
    id: "demo-note-005",
    tagId: "tag-personal",
    tagName: "Personal",
    title: "Lake Tahoe Weekend Trip Checklist",
    transcript:
      "Checklist for the upcoming weekend cabin trip to Lake Tahoe:\n\n1. Cabin Logistics: Door lock code is 8492. Check-in is Friday at 3:00 PM.\n2. Gear: Hiking boots, thermal fleece, water bottles, and portable phone chargers.\n3. Groceries: Coffee beans, oats, trail mix, pasta ingredients, and firewood bundles.\n4. Route: Take Highway 50 through South Lake Tahoe to avoid morning construction on Interstate 80.",
    rawTranscript:
      "Um checklist for the weekend cabin trip to Lake Tahoe. Door code is 8492, check in Friday 3 PM. Remember hiking boots, thermal jackets, portable chargers. Buy coffee beans, pasta, firewood. Take Highway 50 to avoid I-80 construction.",
    summary: [
      "Cabin door code: 8492, check-in Friday 3 PM",
      "Pack hiking gear, thermals, and groceries",
      "Take Highway 50 to bypass construction",
    ],
    duration: 61,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "demo-note-006",
    tagId: "tag-personal",
    tagName: "Personal",
    title: "Atomic Habits Core Takeaways",
    transcript:
      "Reflections on Atomic Habits by James Clear:\n\n- The 1% Rule: Getting 1% better every day results in 37x improvement over a year.\n- The Four Laws of Behavior Change:\n  1. Make it obvious (Environment design & habit stacking)\n  2. Make it attractive (Temptation bundling)\n  3. Make it easy (Reduce friction, 2-minute rule)\n  4. Make it satisfying (Immediate reinforcement & habit tracking)\n\nFocus on identity-based habits rather than outcome-based goals.",
    rawTranscript:
      "Reading Atomic Habits again. Key takeaway: identity based habits instead of outcome based goals. The four laws: make it obvious, attractive, easy, and satisfying. 1% daily compounding.",
    summary: [
      "1% daily improvement yields 37x annual compounding",
      "Four laws: Obvious, Attractive, Easy, Satisfying",
      "Focus on identity-based habits",
    ],
    duration: 55,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "demo-note-007",
    tagId: null,
    tagName: undefined,
    title: "Quick Memo: Clean Design Review",
    transcript:
      "Quick design check: The segmented capsule dock layout looks sharp and the top right status metadata cleanly replaces the old bottom bar strip. Ready to show this off in the demo!",
    rawTranscript:
      "Quick memo: the segmented capsule dock layout looks super sharp and removing the bottom bar strip makes the note editor feel much more spacious. Ready for demo.",
    summary: null,
    duration: 22,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
];

export async function prepareSeededRecordings() {
  const prepared = [];

  for (const note of DEMO_NOTES) {
    const textToEmbed = [
      `Title: ${note.title}`,
      note.tagName ? `Tag: ${note.tagName}` : null,
      note.summary && note.summary.length > 0
        ? `Summary:\n${note.summary.join("\n")}`
        : null,
      `Content:\n${note.transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const embedding = await generateEmbedding(textToEmbed);

    const chunks = chunkVoiceNote({
      content: note.transcript,
      title: note.title,
      tagName: note.tagName ?? null,
    });

    const chunkEmbeddings = await generateEmbeddings(
      chunks.map((c) => c.embeddingText)
    );

    const processedChunks = chunks.map((chunk, index) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: chunkEmbeddings[index],
    }));

    prepared.push({
      ...note,
      embedding,
      chunks: processedChunks,
    });
  }

  return prepared;
}
