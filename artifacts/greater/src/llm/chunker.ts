/**
 * Deterministic, paragraph-aware text chunker for the Greater RAG pipeline.
 *
 * The product constraint is that ingestion must NOT call any LLM — we
 * cannot use a tokenizer-based chunker without dragging the embedder
 * into the orchestration path. Instead, we approximate token counts by
 * word count (~1.3 tokens/word in English; the model's 512-token cap
 * gives us comfortable room at ~400 words/chunk) and split on paragraph
 * boundaries when possible, sentence boundaries otherwise.
 *
 * Output chunks aim for ~400-600 "tokens" with ~50-token overlap between
 * adjacent chunks so a single semantic claim never falls in the gap.
 */

const TARGET_WORDS = 450;
const MAX_WORDS = 600;
const MIN_WORDS = 80;
const OVERLAP_WORDS = 60;

export interface TextChunk {
  text: string;
  chunk_index: number;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|(?<=[.!?])\s{2,}/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitSentences(paragraph: string): string[] {
  // Naive but adequate sentence splitter — Readability output has been
  // normalized to single spaces, so we look for terminators followed by
  // a capital letter or end-of-string.
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z(])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function takeOverlap(text: string, words: number): string {
  const all = text.split(/\s+/).filter(Boolean);
  if (all.length <= words) return text;
  return all.slice(-words).join(" ");
}

/**
 * Split clean text into overlapping chunks suitable for embedding.
 *
 * Strategy:
 *   1. Walk paragraphs.
 *   2. If adding the next paragraph would push the buffer past
 *      MAX_WORDS, flush the buffer as a chunk and seed the next chunk
 *      with the trailing OVERLAP_WORDS from the one we just closed.
 *   3. Paragraphs that are themselves longer than MAX_WORDS are split
 *      further along sentence boundaries before being fed in.
 */
export function chunkText(input: string): TextChunk[] {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const units: string[] = [];
  for (const para of splitParagraphs(cleaned)) {
    if (wordCount(para) <= MAX_WORDS) {
      units.push(para);
      continue;
    }
    // Paragraph too long — split into sentences and re-buffer.
    let buf = "";
    for (const sent of splitSentences(para)) {
      const candidate = buf ? `${buf} ${sent}` : sent;
      if (wordCount(candidate) > MAX_WORDS && buf) {
        units.push(buf);
        buf = sent;
      } else {
        buf = candidate;
      }
    }
    if (buf) units.push(buf);
  }

  const chunks: TextChunk[] = [];
  let buffer = "";
  let bufferWords = 0;

  const flush = () => {
    if (!buffer) return;
    if (bufferWords < MIN_WORDS && chunks.length > 0) {
      // Tiny tail — append to the previous chunk rather than emitting it
      // standalone. Keeps the index from being polluted with stub rows.
      const prev = chunks[chunks.length - 1];
      prev.text = `${prev.text} ${buffer}`.trim();
    } else {
      chunks.push({ text: buffer, chunk_index: chunks.length });
    }
    buffer = "";
    bufferWords = 0;
  };

  for (const unit of units) {
    const unitWords = wordCount(unit);
    if (bufferWords + unitWords > TARGET_WORDS && bufferWords >= MIN_WORDS) {
      const overlap = takeOverlap(buffer, OVERLAP_WORDS);
      flush();
      buffer = overlap ? `${overlap} ${unit}`.trim() : unit;
      bufferWords = wordCount(buffer);
    } else {
      buffer = buffer ? `${buffer}\n\n${unit}` : unit;
      bufferWords += unitWords;
    }
  }
  flush();

  return chunks;
}
