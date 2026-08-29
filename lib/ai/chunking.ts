export interface VoiceNoteChunk {
  chunkIndex: number;
  content: string;
  embeddingText: string;
}

export interface ChunkingOptions {
  targetChunkWords?: number;
  overlapWords?: number;
}

/**
 * Splits text into sentence/clause segments while respecting sentence boundaries.
 */
function splitIntoSentences(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Match sentences ending in punctuation or newlines
  const sentences = normalized.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g);
  if (!sentences) return [normalized];

  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

function countWords(str: string): number {
  return str.split(/\s+/).filter(Boolean).length;
}

/**
 * Chunks a voice note's transcript into coherent passages with contextual headers for RAG embeddings.
 */
export function chunkVoiceNote({
  content,
  title,
  tagName,
  options = {},
}: {
  content: string;
  title: string;
  tagName?: string | null;
  options?: ChunkingOptions;
}): VoiceNoteChunk[] {
  const cleanContent = content.trim();
  if (!cleanContent) return [];

  const targetChunkWords = options.targetChunkWords ?? 220;
  const overlapWords = options.overlapWords ?? 40;

  const totalWords = countWords(cleanContent);
  const contextHeader = `[Note: "${title}"${tagName ? ` | Tag: ${tagName}` : ""}]`;

  // For short notes, return a single chunk
  if (totalWords <= targetChunkWords) {
    return [
      {
        chunkIndex: 0,
        content: cleanContent,
        embeddingText: `${contextHeader}\n${cleanContent}`,
      },
    ];
  }

  const sentences = splitIntoSentences(cleanContent);
  if (sentences.length <= 1) {
    return [
      {
        chunkIndex: 0,
        content: cleanContent,
        embeddingText: `${contextHeader}\n${cleanContent}`,
      },
    ];
  }

  const chunks: VoiceNoteChunk[] = [];
  let currentChunkSentences: string[] = [];
  let currentWordCount = 0;
  let sentenceIndex = 0;

  while (sentenceIndex < sentences.length) {
    const sentence = sentences[sentenceIndex];
    const sentenceWords = countWords(sentence);

    currentChunkSentences.push(sentence);
    currentWordCount += sentenceWords;

    // Check if chunk is complete
    if (currentWordCount >= targetChunkWords || sentenceIndex === sentences.length - 1) {
      const chunkText = currentChunkSentences.join(" ").trim();
      chunks.push({
        chunkIndex: chunks.length,
        content: chunkText,
        embeddingText: `${contextHeader}\n${chunkText}`,
      });

      if (sentenceIndex === sentences.length - 1) {
        break;
      }

      // Calculate overlap window for next chunk
      let overlapCount = 0;
      const overlapSentences: string[] = [];

      for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
        const words = countWords(currentChunkSentences[i]);
        if (overlapCount + words <= overlapWords || overlapSentences.length === 0) {
          overlapSentences.unshift(currentChunkSentences[i]);
          overlapCount += words;
        } else {
          break;
        }
      }

      currentChunkSentences = overlapSentences;
      currentWordCount = overlapCount;
    }

    sentenceIndex++;
  }

  return chunks;
}
