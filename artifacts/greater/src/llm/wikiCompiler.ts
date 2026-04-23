/**
 * NOSTR Wiki-Compiler — Background Knowledge Synthesis Loop
 *
 * Implements Andrej Karpathy's "LLM Wiki" pattern: when a new NOSTR event
 * is ingested into the vector store, this module enqueues it for background
 * synthesis. A local WebGPU inference pass reads the event alongside the
 * current wiki and produces updated topic pages. The compiled index is then
 * injected into the system prompt as a persistent knowledge map.
 *
 * Wiki storage layout (IndexedDB, `greater-wiki` DB, `pages` store):
 *   wiki/index.md   — content-oriented catalog; every page listed with a
 *                     one-line summary, organized by category. Read first on
 *                     every compile pass. Injected into the harness.
 *   wiki/log.md     — append-only chronological ingest record.
 *   wiki/<slug>.md  — one topic page per synthesised concept.
 *
 * Threading contract: events are processed one at a time (single-threaded
 * WebGPU inference). The queue is a simple in-memory FIFO; events that
 * arrive while the model isn't ready are held until model-ready is signalled.
 *
 * Graceful degradation: if the generate function is not yet set (model still
 * loading), events accumulate in the queue and a pause entry is written to
 * wiki/log.md. Processing resumes once setWikiCompilerModelReady() is called.
 */

import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { Event } from "nostr-tools";

/* ------------------------------------------------------------------ */
/*  IndexedDB schema                                                    */
/* ------------------------------------------------------------------ */

interface WikiPage {
  key: string;
  content: string;
  updated_at: number;
}

interface GreaterWikiDB extends DBSchema {
  pages: {
    key: string;
    value: WikiPage;
  };
}

const WIKI_DB_NAME = "greater-wiki";
const WIKI_DB_VERSION = 1;

let wikiDbPromise: Promise<IDBPDatabase<GreaterWikiDB>> | null = null;

function getWikiDb(): Promise<IDBPDatabase<GreaterWikiDB>> {
  if (!wikiDbPromise) {
    wikiDbPromise = openDB<GreaterWikiDB>(WIKI_DB_NAME, WIKI_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pages")) {
          db.createObjectStore("pages", { keyPath: "key" });
        }
      },
    });
  }
  return wikiDbPromise;
}

async function readPage(key: string): Promise<string | null> {
  const db = await getWikiDb();
  const row = await db.get("pages", key);
  return row?.content ?? null;
}

async function writePage(key: string, content: string): Promise<void> {
  const db = await getWikiDb();
  await db.put("pages", { key, content, updated_at: Date.now() });
}

async function appendLog(entry: string): Promise<void> {
  const existing = (await readPage("wiki/log.md")) ?? "";
  await writePage("wiki/log.md", existing + entry + "\n");
}

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

export interface WikiCompilerState {
  enabled: boolean;
  queueDepth: number;
  /** Label of the most recently processed event, or null. */
  lastProcessed: string | null;
  /** Unix ms of the last successful compile, or null. */
  lastUpdated: number | null;
  /** True while a compile pass is running. */
  running: boolean;
}

type Listener = (state: WikiCompilerState) => void;

type GenerateFn = (
  messages: Array<{ role: string; content: string }>,
  maxNewTokens: number,
) => Promise<string>;

/** Internal queue item: pairs the NOSTR event with the resolved content text. */
interface QueuedEvent {
  event: Event;
  /** The actual text to synthesise. For encrypted events this is the
   *  decrypted plaintext; for plain events it equals event.content. */
  contentText: string;
}

/* ------------------------------------------------------------------ */
/*  Persistence key                                                     */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "greater:wiki-compiler-enabled";

/* ------------------------------------------------------------------ */
/*  Module-level singleton state                                        */
/* ------------------------------------------------------------------ */

let _enabled: boolean = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
})();

let _modelReady = false;
let _generateFn: GenerateFn | null = null;

const _queue: QueuedEvent[] = [];
let _running = false;
let _lastProcessed: string | null = null;
let _lastUpdated: number | null = null;
/** True when we already wrote a "paused" log entry for the current backlog. */
let _pauseLogged = false;

const _listeners = new Set<Listener>();

function _currentState(): WikiCompilerState {
  return {
    enabled: _enabled,
    queueDepth: _queue.length,
    lastProcessed: _lastProcessed,
    lastUpdated: _lastUpdated,
    running: _running,
  };
}

function _notify() {
  const state = _currentState();
  for (const fn of _listeners) {
    try {
      fn(state);
    } catch {
      // swallow — listener errors must not break the compile loop
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/** Subscribe to wiki compiler state changes. Returns an unsubscribe fn. */
export function subscribeWikiCompiler(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Read current state synchronously (for initial render). */
export function getWikiCompilerState(): WikiCompilerState {
  return _currentState();
}

/** Enable or disable the wiki compiler. Persisted to localStorage. */
export function setWikiCompilerEnabled(enabled: boolean): void {
  _enabled = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // best-effort
    }
  }
  _notify();
  if (enabled && _modelReady && _generateFn && _queue.length > 0) {
    void _drainQueue();
  }
}

/**
 * Called by LLMProvider once the WebGPU model is fully ready. Flushes any
 * queued events.
 */
export function setWikiCompilerModelReady(generateFn: GenerateFn): void {
  _modelReady = true;
  _generateFn = generateFn;
  _pauseLogged = false; // reset so next pause is re-logged
  if (_enabled && _queue.length > 0) {
    void _drainQueue();
  }
}

/**
 * Enqueue a NOSTR event for background synthesis. Called from nostrSync
 * after the event has been embedded into the vector store.
 *
 * @param event       The original NOSTR event object (for metadata).
 * @param contentText The resolved content to synthesise. For encrypted events
 *                    this must be the decrypted plaintext. For plain events it
 *                    should equal event.content. Defaults to event.content
 *                    when omitted (plain-event shorthand).
 */
export function enqueueWikiEvent(event: Event, contentText?: string): void {
  if (!_enabled) return;
  const text = contentText ?? event.content ?? "";
  if (!text.trim() || text.trim().length < 30) return;
  _queue.push({ event, contentText: text });
  _notify();
  if (_modelReady && _generateFn && !_running) {
    void _drainQueue();
  } else if (!_modelReady && !_pauseLogged) {
    // Log a pause entry once so the log reflects when we started
    // accumulating events before the model was ready.
    _pauseLogged = true;
    appendLog(
      `## [${_today()}] paused | model not yet loaded — ${_queue.length} event(s) queued`,
    ).catch(() => {});
  }
}

/**
 * Read `wiki/index.md` from IndexedDB. Returns null if the wiki has not been
 * compiled yet. Used by LLMProvider to inject the knowledge map into the
 * system prompt.
 */
export async function getWikiIndexContent(): Promise<string | null> {
  try {
    return await readPage("wiki/index.md");
  } catch {
    return null;
  }
}

/**
 * If `wiki/index.md` exceeds `maxChars`, compress it in-place (write
 * the compressed version back to IndexedDB) and return the compressed
 * content. Called at harness injection time so the system prompt slot
 * never overflows. Returns the (possibly compressed) content, or null
 * when no index exists yet.
 */
export async function getOrCompressWikiIndex(
  maxChars: number = 6000,
): Promise<string | null> {
  try {
    const content = await readPage("wiki/index.md");
    if (!content) return null;
    if (content.length <= maxChars) return content;
    const compressed = _compressIndex(content, maxChars);
    await writePage("wiki/index.md", compressed);
    return compressed;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Compile loop                                                        */
/* ------------------------------------------------------------------ */

async function _drainQueue(): Promise<void> {
  if (_running) return;
  _running = true;
  _notify();
  try {
    while (_queue.length > 0 && _enabled && _modelReady && _generateFn) {
      const item = _queue.shift()!;
      _notify(); // update queueDepth
      try {
        await _compileEvent(item, _generateFn);
      } catch (err) {
        // Log failure to wiki/log.md and continue with next event
        const label = _eventLabel(item.event);
        const dateStr = _today();
        await appendLog(
          `## [${dateStr}] ingest | ${label} — ERROR: ${(err as Error).message}`,
        ).catch(() => {});
      }
    }
  } finally {
    _running = false;
    _notify();
  }
}

async function _compileEvent(
  item: QueuedEvent,
  generate: GenerateFn,
): Promise<void> {
  const { event, contentText } = item;
  const label = _eventLabel(event);
  const dateStr = _today();

  // 1. Read wiki/index.md to orient ourselves
  const currentIndex = (await readPage("wiki/index.md")) ?? "";

  // 2. Identify relevant existing pages by scanning the index for slugs
  //    whose names appear in the event content (simple keyword heuristic).
  const relevantSlugs = _findRelevantSlugs(currentIndex, label + " " + contentText);
  const relevantPages: Array<{ path: string; content: string }> = [];
  for (const slug of relevantSlugs) {
    const path = `wiki/${slug}.md`;
    const pageContent = await readPage(path).catch(() => null);
    if (pageContent) {
      relevantPages.push({ path, content: pageContent });
    }
  }

  // 3. Build the synthesis prompt (event + relevant existing pages)
  const prompt = _buildPrompt(label, contentText, currentIndex, relevantPages);

  // 4. Run local inference (never cloud)
  const raw = await generate(
    [
      {
        role: "system",
        content:
          "You are a wiki compiler. You synthesise NOSTR events into structured knowledge pages. Follow the exact output format specified.",
      },
      { role: "user", content: prompt },
    ],
    512,
  );

  // 5. Parse the structured response
  const parsed = _parseCompilerResponse(raw);

  if (parsed.pagePath && parsed.pageContent) {
    const safePath = _safePath(parsed.pagePath);

    // Write the updated or new topic page
    await writePage(safePath, parsed.pageContent);

    // Update wiki/index.md
    const updatedIndex = _updateIndex(
      currentIndex,
      safePath,
      label,
      parsed.indexEntry,
    );
    const compressed = _compressIndex(updatedIndex, 6000);
    await writePage("wiki/index.md", compressed);
  }

  // 6. Append to log.md
  await appendLog(`## [${dateStr}] ingest | ${label}`);

  _lastProcessed = label;
  _lastUpdated = Date.now();
  _notify();
}

/* ------------------------------------------------------------------ */
/*  Relevant-page heuristic                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse the index to find page slugs whose titles appear in the event text.
 * Returns up to 3 slugs to avoid overloading the prompt context.
 */
function _findRelevantSlugs(index: string, eventText: string): string[] {
  if (!index) return [];
  const eventLower = eventText.toLowerCase();
  const slugs: string[] = [];

  // Each index line looks like: - [slug](wiki/slug.md) — summary
  const lineRe = /- \[([^\]]+)\]\(wiki\/([^)]+)\.md\)/g;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(index)) !== null) {
    const title = match[1]!;
    const slug = match[2]!;
    // Match if slug words or title words appear in the event text
    const titleWords = title.toLowerCase().split(/[-_\s]+/).filter((w) => w.length > 3);
    if (titleWords.some((w) => eventLower.includes(w))) {
      slugs.push(slug);
      if (slugs.length >= 3) break;
    }
  }
  return slugs;
}

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                      */
/* ------------------------------------------------------------------ */

function _buildPrompt(
  eventLabel: string,
  eventContent: string,
  currentIndex: string,
  relevantPages: Array<{ path: string; content: string }>,
): string {
  const parts: string[] = [];

  parts.push("# Task: Update the knowledge wiki");
  parts.push("");
  parts.push("## New NOSTR Event");
  parts.push(`Title: ${eventLabel}`);
  parts.push("");
  parts.push(eventContent.slice(0, 2000));
  parts.push("");

  if (currentIndex) {
    parts.push("## Current wiki/index.md");
    parts.push(currentIndex.slice(0, 1500));
    parts.push("");
  }

  if (relevantPages.length > 0) {
    parts.push("## Relevant existing wiki pages");
    for (const page of relevantPages) {
      parts.push(`### ${page.path}`);
      parts.push(page.content.slice(0, 600));
      parts.push("");
    }
  }

  parts.push("## Instructions");
  parts.push(
    "Based on the new event and any relevant existing pages, produce an updated or new topic wiki page and a one-line index entry.",
  );
  parts.push(
    "If the event touches an existing topic in the index, update that page; otherwise create a new one.",
  );
  parts.push("");
  parts.push("Respond ONLY in the following format (include the === delimiters):");
  parts.push("");
  parts.push("=== PAGE_PATH ===");
  parts.push("wiki/<slug>.md");
  parts.push("=== PAGE_CONTENT ===");
  parts.push("<markdown content for the topic page>");
  parts.push("=== INDEX_ENTRY ===");
  parts.push("<one-line summary for the index catalog>");

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Response parser                                                     */
/* ------------------------------------------------------------------ */

interface ParsedResponse {
  pagePath: string | null;
  pageContent: string | null;
  indexEntry: string | null;
}

function _parseCompilerResponse(raw: string): ParsedResponse {
  const pathMatch = raw.match(
    /===\s*PAGE_PATH\s*===\s*\n([\s\S]*?)(?:===|$)/,
  );
  const contentMatch = raw.match(
    /===\s*PAGE_CONTENT\s*===\s*\n([\s\S]*?)(?:===|$)/,
  );
  const entryMatch = raw.match(
    /===\s*INDEX_ENTRY\s*===\s*\n([\s\S]*?)(?:===|$)/,
  );

  return {
    pagePath: pathMatch?.[1]?.trim() ?? null,
    pageContent: contentMatch?.[1]?.trim() ?? null,
    indexEntry: entryMatch?.[1]?.trim() ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Index management                                                    */
/* ------------------------------------------------------------------ */

/**
 * Update the index catalog. Inserts or replaces the entry for `pagePath`.
 */
function _updateIndex(
  currentIndex: string,
  pagePath: string,
  _label: string,
  indexEntry: string | null,
): string {
  const slug = pagePath.replace(/^wiki\//, "").replace(/\.md$/, "");
  const summary = indexEntry?.slice(0, 120) ?? _label;
  const linePattern = new RegExp(
    `^- \\[${_escapeRegex(slug)}\\]\\(${_escapeRegex(pagePath)}\\).*$`,
    "m",
  );
  const newLine = `- [${slug}](${pagePath}) — ${summary}`;

  if (linePattern.test(currentIndex)) {
    return currentIndex.replace(linePattern, newLine);
  }

  const recentHeader = "## Recent";
  if (currentIndex.includes(recentHeader)) {
    return currentIndex.replace(recentHeader, `${recentHeader}\n${newLine}`);
  }

  const header = [
    "# Knowledge Wiki Index",
    "",
    "_Auto-compiled from NOSTR events. Updated on every ingest._",
    "",
  ].join("\n");

  if (!currentIndex) {
    return `${header}${recentHeader}\n${newLine}`;
  }
  return `${currentIndex}\n\n${recentHeader}\n${newLine}`;
}

/**
 * Compress the index to ≤ maxChars by dropping older entries from the
 * "Recent" section. The header and non-Recent sections are always preserved.
 */
function _compressIndex(index: string, maxChars: number): string {
  if (index.length <= maxChars) return index;

  const lines = index.split("\n");
  while (index.length > maxChars && lines.length > 5) {
    const firstBullet = lines.findIndex(
      (l, i) => i > 0 && l.startsWith("- ["),
    );
    if (firstBullet === -1) break;
    lines.splice(firstBullet, 1);
    index = lines.join("\n");
  }

  if (index.length > maxChars) {
    index = index.slice(0, maxChars - 3) + "…";
  }

  return index;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                           */
/* ------------------------------------------------------------------ */

function _eventLabel(event: Event): string {
  const titleTag = event.tags?.find((t) => t[0] === "title");
  if (titleTag?.[1]) return titleTag[1];
  const subjectTag = event.tags?.find((t) => t[0] === "subject");
  if (subjectTag?.[1]) return subjectTag[1];
  const preview = event.content?.slice(0, 60).replace(/\s+/g, " ").trim();
  return preview ? `${preview}…` : `event:${event.id?.slice(0, 8) ?? "?"}`;
}

function _today(): string {
  return new Date().toISOString().slice(0, 10);
}

function _safePath(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^[^a-z0-9wiki]/i, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/\.\.+/g, ".");

  if (!cleaned.startsWith("wiki/")) {
    const slug = cleaned.replace(/^.*?([^/]+)$/, "$1").replace(/\.md$/, "");
    return `wiki/${slug || "note"}.md`;
  }
  if (!cleaned.endsWith(".md")) {
    return `${cleaned}.md`;
  }
  return cleaned;
}

function _escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
