/**
 * Build the Bitcoin knowledge seed bundle.
 *
 * The output bundle (`data/seeds/bitcoin.json`) is the curated corpus
 * that powers the FinTech demo's RAG layer. The bundle is gitignored;
 * the builder script and its source list are not.
 *
 * Sources
 *   1. Bitcoin OpTech newsletters (every issue, full text via Readability)
 *   2. The last 12 months of merged commits to bitcoin/bitcoin (bias=core)
 *      and bitcoinknots/bitcoin (bias=knots) — commit messages, not patches
 *   3. A curated list of high-signal BitcoinTalk threads, configured at
 *      scripts/src/bitcoin-seed/bitcointalk-threads.json
 *
 * Design notes
 *   - **Anonymous-first.** The builder requires no credentials. Set
 *     GITHUB_TOKEN to make GitHub fetches ~80x faster (5,000 req/hr
 *     authenticated vs. 60 req/hr unauthenticated); without it the
 *     build still completes, just slowly.
 *   - **Adaptive throttling.** GitHub fetches read X-RateLimit-Remaining
 *     and X-RateLimit-Reset and sleep until reset when the budget is
 *     exhausted. There are no fixed delays — the server tells us when
 *     we may continue.
 *   - **Polite to non-API hosts.** OpTech and BitcoinTalk fetches are
 *     gated by a small fixed delay so we never burst against shared
 *     community infrastructure.
 *   - **Resumable.** Every page of GitHub commits and every successful
 *     OpTech / BitcoinTalk fetch is cached to `data/seeds/.cache/`. A
 *     re-run picks up from where the previous run stopped (whether
 *     interrupted by Ctrl-C, a network blip, or a rate-limit sleep
 *     longer than you cared to wait for).
 *
 * Usage
 *   pnpm --filter @workspace/scripts run build-bitcoin-seed
 *   GITHUB_TOKEN=ghp_xxx pnpm --filter @workspace/scripts run build-bitcoin-seed
 */

import { mkdir, readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "data", "seeds", "bitcoin.json");
const PUBLIC_OUTPUT_PATH = path.join(
  REPO_ROOT,
  "artifacts",
  "emerald",
  "public",
  "seeds",
  "bitcoin.json",
);
const CACHE_ROOT = path.join(REPO_ROOT, "data", "seeds", ".cache");
const THREADS_CONFIG = path.join(
  __dirname,
  "bitcoin-seed",
  "bitcointalk-threads.json",
);
const MISES_CONFIG = path.join(
  __dirname,
  "bitcoin-seed",
  "mises-works.json",
);
const NAKAMOTO_CONFIG = path.join(
  __dirname,
  "bitcoin-seed",
  "nakamoto-works.json",
);

const USER_AGENT =
  "GreaterSeedBuilder/1.0 (+https://hire.colonhyphenbracket.pink) Readability/1.0";

const TARGET_WORDS = 450;
const MAX_WORDS = 600;
const MIN_WORDS = 60;
const OVERLAP_WORDS = 60;

/** Minimum spacing between requests to the same shared community host. */
const POLITE_DELAY_MS = 400;

/** Below this many remaining requests we sleep until the GitHub reset. */
const GITHUB_REMAINING_FLOOR = 2;

type Bias = "core" | "knots" | "neutral";

interface BundleChunk {
  text: string;
  chunk_index: number;
}
interface BundleDoc {
  source_url: string;
  source_label: string;
  source_type:
    | "optech"
    | "github-commit"
    | "bitcointalk"
    | "mises"
    | "nakamoto";
  bias: Bias;
  /**
   * Optional. When present (Mises/Nakamoto sources), it is added to the
   * `source_label` so citations like [N] surface "Rothbard — *What Has
   * Government Done to Our Money?*" to the model in its retrieved
   * snippets.
   */
  author?: string;
  chunks: BundleChunk[];
}
interface Bundle {
  version: string;
  generated_at: string;
  documents: BundleDoc[];
}

/* -------------------------------------------------------------- */
/*  Utilities                                                     */
/* -------------------------------------------------------------- */

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function fileExists(p: string): Promise<boolean> {
  return stat(p)
    .then(() => true)
    .catch(() => false);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

function chunkText(input: string): BundleChunk[] {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  // Split on sentence boundaries. The previous regex looked for `\s{2,}`,
  // which never matched after the `\s+` collapse above and produced one
  // giant chunk per document — every long-form source (OpTech newsletter,
  // Mises book, Nakamoto essay) was landing as a single 1000-10000 word
  // chunk that the embedder then truncated to its first ~400 words.
  //
  // The lookahead `(?=[A-Z"'(\[])` prevents over-splitting on abbreviations
  // like "e.g.", "i.e.", "U.S.", "v1.5", or "Rothbard, M. N.". A real
  // sentence boundary is followed by whitespace and then a capital letter,
  // an opening quote, or an opening paren — abbreviations are followed by
  // a lowercase continuation.
  const paragraphs = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z"'(\[])/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const wc = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const chunks: BundleChunk[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    const candidate = buffer ? `${buffer} ${p}` : p;
    if (wc(candidate) > TARGET_WORDS && wc(buffer) >= MIN_WORDS) {
      chunks.push({ text: buffer, chunk_index: chunks.length });
      const words = buffer.split(/\s+/);
      const overlap = words.slice(-OVERLAP_WORDS).join(" ");
      buffer = `${overlap} ${p}`.trim();
    } else if (wc(candidate) > MAX_WORDS) {
      chunks.push({ text: buffer || p, chunk_index: chunks.length });
      buffer = "";
    } else {
      buffer = candidate;
    }
  }
  if (buffer) chunks.push({ text: buffer, chunk_index: chunks.length });
  return chunks;
}

function readabilityExtract(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.textContent) return null;
  return article.textContent.replace(/\s+/g, " ").trim();
}

function safeKey(url: string): string {
  return url.replace(/[^a-z0-9]+/gi, "_").slice(0, 200);
}

async function readCache<T>(filePath: string): Promise<T | null> {
  if (!(await fileExists(filePath))) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Atomic JSON write: write to a sibling tmp file, then rename. A killed
 * process leaves either the previous good file or no file at all — never
 * a half-written one.
 */
async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(data), "utf8");
  try {
    await rename(tmp, filePath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function writeCache(filePath: string, data: unknown): Promise<void> {
  await writeJsonAtomic(filePath, data);
}

/**
 * A run-state file pins the `since` timestamp for a given repo across
 * resumes. Without it, every rerun would compute a fresh `Date.now()`
 * and never hit the page cache from the previous run. The state is
 * cleared once the build completes successfully.
 */
interface RunState {
  since_iso: string;
}

async function loadOrInitRunState(
  cacheDir: string,
  monthsBack: number,
): Promise<RunState> {
  const statePath = path.join(cacheDir, "run-state.json");
  const existing = await readCache<RunState>(statePath);
  if (existing?.since_iso) return existing;
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  // Round to the start of the day (UTC) so that two runs started on the
  // same calendar day always converge on the same `since` value, even
  // across container restarts.
  since.setUTCHours(0, 0, 0, 0);
  const state: RunState = { since_iso: since.toISOString() };
  await writeJsonAtomic(statePath, state);
  return state;
}

async function clearRunState(cacheDir: string): Promise<void> {
  const statePath = path.join(cacheDir, "run-state.json");
  await unlink(statePath).catch(() => {});
}

/* -------------------------------------------------------------- */
/*  Polite host throttle (OpTech, BitcoinTalk)                    */
/* -------------------------------------------------------------- */

const lastHostFetch = new Map<string, number>();

async function politeFetchText(url: string): Promise<string> {
  const host = new URL(url).host;
  const last = lastHostFetch.get(host);
  if (last !== undefined) {
    const elapsed = Date.now() - last;
    if (elapsed < POLITE_DELAY_MS) {
      await sleep(POLITE_DELAY_MS - elapsed);
    }
  }
  lastHostFetch.set(host, Date.now());

  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

/* -------------------------------------------------------------- */
/*  GitHub fetch with adaptive rate-limit handling                */
/* -------------------------------------------------------------- */

interface GhRateLimit {
  remaining: number | null;
  resetEpochSeconds: number | null;
}

function readRateLimit(res: Response): GhRateLimit {
  const remainingHeader = res.headers.get("x-ratelimit-remaining");
  const resetHeader = res.headers.get("x-ratelimit-reset");
  return {
    remaining: remainingHeader === null ? null : Number(remainingHeader),
    resetEpochSeconds: resetHeader === null ? null : Number(resetHeader),
  };
}

async function githubFetch(
  url: string,
  authenticated: boolean,
): Promise<{ res: Response; rate: GhRateLimit }> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github.v3+json",
    "user-agent": USER_AGENT,
  };
  if (authenticated) {
    headers["authorization"] = `Bearer ${process.env["GITHUB_TOKEN"]}`;
  }
  const res = await fetch(url, { headers });
  return { res, rate: readRateLimit(res) };
}

/**
 * Fetches a URL, transparently sleeping out rate-limit windows. Handles
 * three signals from GitHub:
 *
 *   - Primary rate limit:    403 + X-RateLimit-Remaining: 0 + X-RateLimit-Reset
 *   - Secondary rate limit:  403 or 429 + Retry-After (seconds or HTTP-date)
 *   - Transient 5xx:         retried with capped exponential backoff + jitter
 *
 * Anything else is surfaced as an error.
 */
async function githubFetchWithBackoff(
  url: string,
  authenticated: boolean,
): Promise<{ body: unknown; rate: GhRateLimit }> {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { res, rate } = await githubFetch(url, authenticated);
    if (res.ok) {
      return { body: await res.json(), rate };
    }

    // Primary rate limit: budget exhausted with a known reset time.
    if (
      res.status === 403 &&
      rate.remaining === 0 &&
      rate.resetEpochSeconds !== null
    ) {
      const waitMs = Math.max(1000, rate.resetEpochSeconds * 1000 - Date.now() + 2000);
      const resetAt = new Date(rate.resetEpochSeconds * 1000)
        .toISOString()
        .replace(/\.\d+Z$/, "Z");
      console.log(
        `   ⏸  GitHub rate-limit hit. Sleeping ${formatDuration(waitMs)} until ${resetAt}.${
          authenticated ? "" : " (Set GITHUB_TOKEN to skip — 5000 req/hr instead of 60.)"
        }`,
      );
      await sleep(waitMs);
      continue;
    }

    // Secondary rate limit / abuse detection.
    if (res.status === 429 || res.status === 403) {
      const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
      if (retryAfterMs !== null) {
        const waitMs = Math.min(retryAfterMs, 5 * 60 * 1000); // cap at 5 min
        console.log(
          `   ⏸  GitHub asked us to back off (${res.status}). Sleeping ${formatDuration(waitMs)}.`,
        );
        await sleep(waitMs);
        continue;
      }
    }

    // Transient server errors: backoff + jitter, then retry.
    if (res.status >= 500 && res.status < 600) {
      const waitMs = Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      console.log(
        `   ⏸  GitHub returned ${res.status}. Backing off ${formatDuration(waitMs)} and retrying.`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  throw new Error(`Gave up after ${MAX_ATTEMPTS} attempts: ${url}`);
}

/** Parses a Retry-After header (seconds-as-int or HTTP-date) into ms. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

/**
 * If the budget is about to run out, sleep until the reset rather than
 * waste the last request on a likely-403.
 */
async function maybeSleepForRateLimit(
  rate: GhRateLimit,
  authenticated: boolean,
): Promise<void> {
  if (
    rate.remaining !== null &&
    rate.remaining <= GITHUB_REMAINING_FLOOR &&
    rate.resetEpochSeconds !== null
  ) {
    const waitMs = Math.max(
      0,
      rate.resetEpochSeconds * 1000 - Date.now() + 2000,
    );
    if (waitMs <= 0) return;
    const resetAt = new Date(rate.resetEpochSeconds * 1000)
      .toISOString()
      .replace(/\.\d+Z$/, "Z");
    console.log(
      `   ⏸  GitHub budget nearly exhausted (${rate.remaining} left). Sleeping ${formatDuration(waitMs)} until ${resetAt}.${
        authenticated ? "" : " (Set GITHUB_TOKEN to skip these waits.)"
      }`,
    );
    await sleep(waitMs);
  }
}

/* -------------------------------------------------------------- */
/*  OpTech                                                        */
/* -------------------------------------------------------------- */

async function fetchOpTechNewsletters(): Promise<BundleDoc[]> {
  console.log("Fetching Bitcoin OpTech newsletter index…");
  const indexUrl = "https://bitcoinops.org/en/newsletters/";
  const index = await politeFetchText(indexUrl);
  const dom = new JSDOM(index, { url: indexUrl });
  const links = Array.from(
    dom.window.document.querySelectorAll("a[href^='/en/newsletters/']"),
  )
    .map((a) => (a as { href?: string }).href ?? "")
    .filter(
      (href) =>
        /\/en\/newsletters\/\d{4}\/\d{2}\/\d{2}\/?$/.test(href) ||
        /^https:\/\/bitcoinops\.org\/en\/newsletters\/\d{4}\/\d{2}\/\d{2}\/?$/.test(
          href,
        ),
    );
  const unique = Array.from(new Set(links)).map((href) =>
    href.startsWith("http") ? href : `https://bitcoinops.org${href}`,
  );

  console.log(`  ${unique.length} newsletters found.`);
  const docs: BundleDoc[] = [];
  for (let i = 0; i < unique.length; i += 1) {
    const url = unique[i];
    const cachePath = path.join(CACHE_ROOT, "optech", `${safeKey(url)}.json`);
    let cached = await readCache<BundleDoc>(cachePath);
    if (!cached) {
      try {
        const html = await politeFetchText(url);
        const body = readabilityExtract(html, url);
        if (!body || body.length < 200) {
          console.log(
            `  [${i + 1}/${unique.length}] skip ${url} (no readable body)`,
          );
          continue;
        }
        const dom2 = new JSDOM(html, { url });
        const title =
          dom2.window.document.querySelector("title")?.textContent?.trim() ??
          url;
        cached = {
          source_url: url,
          source_label: title,
          source_type: "optech",
          bias: "neutral",
          chunks: chunkText(body),
        };
        await writeCache(cachePath, cached);
      } catch (err) {
        console.warn(
          `  [${i + 1}/${unique.length}] skip ${url}: ${(err as Error).message}`,
        );
        continue;
      }
    }
    docs.push(cached);
    if ((i + 1) % 10 === 0 || i === unique.length - 1) {
      console.log(`  [${i + 1}/${unique.length}] OpTech…`);
    }
  }
  console.log(`  → ${docs.length} OpTech docs (${countChunks(docs)} chunks)`);
  return docs;
}

/* -------------------------------------------------------------- */
/*  GitHub commits                                                */
/* -------------------------------------------------------------- */

interface GhCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string };
  };
}

async function fetchGithubCommits(
  repo: string,
  bias: Bias,
  monthsBack: number,
): Promise<BundleDoc[]> {
  const authenticated = Boolean(process.env["GITHUB_TOKEN"]);
  const cacheDir = path.join(CACHE_ROOT, "github", safeKey(repo));
  const runState = await loadOrInitRunState(cacheDir, monthsBack);
  const sinceIso = runState.since_iso;

  console.log(
    `Fetching commits for ${repo} since ${sinceIso} ` +
      `(${authenticated ? "authenticated, fast" : "anonymous, ~60 req/hr"})`,
  );

  // Page cache is namespaced by the `since` window so that a build
  // with a fresh `since` can never silently reuse a previous window's
  // commit pages.
  const pageCacheDir = path.join(cacheDir, `since-${safeKey(sinceIso)}`);

  const docs: BundleDoc[] = [];
  let page = 1;
  let stoppedNaturally = false;
  while (page <= 200) {
    const url = `https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(
      sinceIso,
    )}&per_page=100&page=${page}`;
    const cachePath = path.join(pageCacheDir, `page-${page.toString().padStart(3, "0")}.json`);

    let batch = await readCache<GhCommit[]>(cachePath);
    if (batch === null) {
      const { body, rate } = await githubFetchWithBackoff(url, authenticated);
      batch = body as GhCommit[];
      await writeCache(cachePath, batch);
      const remainingStr =
        rate.remaining === null ? "?" : String(rate.remaining);
      console.log(
        `  page ${page.toString().padStart(2, "0")} · ${batch.length.toString().padStart(3, " ")} commits · GitHub budget left: ${remainingStr}`,
      );
      await maybeSleepForRateLimit(rate, authenticated);
    } else {
      console.log(
        `  page ${page.toString().padStart(2, "0")} · ${batch.length.toString().padStart(3, " ")} commits · cached`,
      );
    }

    if (batch.length === 0) {
      stoppedNaturally = true;
      break;
    }
    for (const c of batch) {
      const message = c.commit.message.trim();
      if (!message) continue;
      const subject = message.split("\n", 1)[0].slice(0, 120);
      const text = `Commit ${c.sha.slice(0, 12)} (${c.commit.author?.date ?? "unknown date"})\n\n${message}`;
      docs.push({
        source_url: c.html_url,
        source_label: `${repo}@${c.sha.slice(0, 7)} — ${subject}`,
        source_type: "github-commit",
        bias,
        chunks: [{ text, chunk_index: 0 }],
      });
    }
    if (batch.length < 100) {
      stoppedNaturally = true;
      break;
    }
    page += 1;
  }
  console.log(
    `  → ${docs.length} commits from ${repo}` +
      (stoppedNaturally ? "" : " (stopped at page cap of 200)"),
  );
  // Successful end-to-end pass for this repo: drop the run-state pin so
  // the next build picks a fresh `since`. Cached pages remain on disk
  // so a subsequent rebuild of the *same* `since` is still instant if
  // the operator re-pins it manually.
  await clearRunState(cacheDir);
  return docs;
}

/* -------------------------------------------------------------- */
/*  BitcoinTalk                                                   */
/* -------------------------------------------------------------- */

interface ThreadConfig {
  url: string;
  label?: string;
  bias?: Bias;
}

async function fetchBitcoinTalkThreads(
  configPath: string,
): Promise<BundleDoc[]> {
  let configRaw: string;
  try {
    configRaw = await readFile(configPath, "utf8");
  } catch {
    console.log("No BitcoinTalk thread config; skipping.");
    return [];
  }
  const config = JSON.parse(configRaw) as ThreadConfig[];
  console.log(`Fetching ${config.length} BitcoinTalk thread(s)…`);

  const docs: BundleDoc[] = [];
  for (let i = 0; i < config.length; i += 1) {
    const thread = config[i];
    const cachePath = path.join(
      CACHE_ROOT,
      "bitcointalk",
      `${safeKey(thread.url)}.json`,
    );
    let cached = await readCache<BundleDoc>(cachePath);
    if (!cached) {
      try {
        const html = await politeFetchText(thread.url);
        const body = readabilityExtract(html, thread.url);
        if (!body || body.length < 200) {
          console.log(
            `  [${i + 1}/${config.length}] skip ${thread.url} (no readable body)`,
          );
          continue;
        }
        const dom2 = new JSDOM(html, { url: thread.url });
        const title =
          thread.label ??
          dom2.window.document.querySelector("title")?.textContent?.trim() ??
          thread.url;
        cached = {
          source_url: thread.url,
          source_label: title,
          source_type: "bitcointalk",
          bias: thread.bias ?? "neutral",
          chunks: chunkText(body),
        };
        await writeCache(cachePath, cached);
      } catch (err) {
        console.warn(
          `  [${i + 1}/${config.length}] skip ${thread.url}: ${(err as Error).message}`,
        );
        continue;
      }
    }
    docs.push(cached);
  }
  console.log(
    `  → ${docs.length} BitcoinTalk threads (${countChunks(docs)} chunks)`,
  );
  return docs;
}

/* -------------------------------------------------------------- */
/*  Long-form open-licensed works (Mises Institute, Nakamoto       */
/*  Institute). Both publish under permissive licenses (CC BY 4.0  */
/*  and MIT respectively) and request canonical-URL citations,     */
/*  which the bot's system prompt enforces. See docs/SOURCES.md.   */
/* -------------------------------------------------------------- */

interface LongFormConfig {
  url: string;
  label?: string;
  author?: string;
}

async function fetchLongFormWorks(
  configPath: string,
  sourceType: "mises" | "nakamoto",
): Promise<BundleDoc[]> {
  let configRaw: string;
  try {
    configRaw = await readFile(configPath, "utf8");
  } catch {
    console.log(`No ${sourceType} config; skipping.`);
    return [];
  }
  const config = JSON.parse(configRaw) as LongFormConfig[];
  console.log(`Fetching ${config.length} ${sourceType} work(s)…`);

  const docs: BundleDoc[] = [];
  for (let i = 0; i < config.length; i += 1) {
    const work = config[i];
    const cachePath = path.join(
      CACHE_ROOT,
      sourceType,
      `${safeKey(work.url)}.json`,
    );
    let cached = await readCache<BundleDoc>(cachePath);
    if (!cached) {
      try {
        const html = await politeFetchText(work.url);
        const body = readabilityExtract(html, work.url);
        if (!body || body.length < 200) {
          console.log(
            `  [${i + 1}/${config.length}] skip ${work.url} (no readable body)`,
          );
          continue;
        }
        const dom2 = new JSDOM(html, { url: work.url });
        const title =
          work.label ??
          dom2.window.document.querySelector("title")?.textContent?.trim() ??
          work.url;
        cached = {
          source_url: work.url,
          source_label: title,
          source_type: sourceType,
          bias: "neutral",
          ...(work.author ? { author: work.author } : {}),
          chunks: chunkText(body),
        };
        await writeCache(cachePath, cached);
      } catch (err) {
        console.warn(
          `  [${i + 1}/${config.length}] skip ${work.url}: ${(err as Error).message}`,
        );
        continue;
      }
    }
    docs.push(cached);
  }
  console.log(
    `  → ${docs.length} ${sourceType} works (${countChunks(docs)} chunks)`,
  );
  return docs;
}

/* -------------------------------------------------------------- */
/*  Driver                                                        */
/* -------------------------------------------------------------- */

function countChunks(docs: BundleDoc[]): number {
  return docs.reduce((n, d) => n + d.chunks.length, 0);
}

function countWords(docs: BundleDoc[]): number {
  return docs.reduce(
    (n, d) =>
      n +
      d.chunks.reduce(
        (m, c) => m + c.text.split(/\s+/).filter(Boolean).length,
        0,
      ),
    0,
  );
}

async function main() {
  console.log("Building Bitcoin knowledge seed bundle.");
  if (!process.env["GITHUB_TOKEN"]) {
    console.log(
      "GITHUB_TOKEN is unset. GitHub fetches will run anonymously at " +
        "~60 req/hr; the build will adaptively sleep through rate-limit " +
        "windows. Expect ~2–3 hours wall time. Set GITHUB_TOKEN to a " +
        "fine-grained read-only token to finish in ~2 minutes.",
    );
  }
  console.log("");

  const startedAt = Date.now();

  const optech = await fetchOpTechNewsletters();
  console.log("");
  const core = await fetchGithubCommits("bitcoin/bitcoin", "core", 12);
  console.log("");
  const knots = await fetchGithubCommits("bitcoinknots/bitcoin", "knots", 12);
  console.log("");
  const talk = await fetchBitcoinTalkThreads(THREADS_CONFIG);
  console.log("");
  const mises = await fetchLongFormWorks(MISES_CONFIG, "mises");
  console.log("");
  const nakamoto = await fetchLongFormWorks(NAKAMOTO_CONFIG, "nakamoto");
  console.log("");

  // Re-chunk every cached document with the current chunker. The fetch
  // cache stores fully-formed BundleDocs (chunks + metadata) so a chunker
  // bug fix would otherwise be invisible until every cache entry is
  // manually invalidated. Re-joining and re-splitting on assembly keeps
  // the on-disk corpus in lockstep with the chunker source. Cheap: this
  // runs in milliseconds even for the 7k-doc corpus.
  const rechunk = (d: BundleDoc): BundleDoc => ({
    ...d,
    chunks: chunkText(d.chunks.map((c) => c.text).join(" ")),
  });
  const bundle: Bundle = {
    version: "v1",
    generated_at: new Date().toISOString(),
    documents: [
      ...optech.map(rechunk),
      ...core.map(rechunk),
      ...knots.map(rechunk),
      ...talk.map(rechunk),
      ...mises.map(rechunk),
      ...nakamoto.map(rechunk),
    ],
  };

  await writeJsonAtomic(OUTPUT_PATH, bundle);
  await writeJsonAtomic(PUBLIC_OUTPUT_PATH, bundle);

  const totalChunks = countChunks(bundle.documents);
  const sizeMb = ((await readFile(OUTPUT_PATH)).byteLength / 1024 / 1024).toFixed(2);
  const elapsed = formatDuration(Date.now() - startedAt);
  console.log(`Wrote ${OUTPUT_PATH} in ${elapsed}.`);
  console.log(
    `  ${bundle.documents.length} documents · ${totalChunks} chunks · ${sizeMb} MB`,
  );
  console.log(
    `  bias breakdown: core=${bundle.documents.filter((d) => d.bias === "core").length}, ` +
      `knots=${bundle.documents.filter((d) => d.bias === "knots").length}, ` +
      `neutral=${bundle.documents.filter((d) => d.bias === "neutral").length}`,
  );
  const totalWords = countWords(bundle.documents);
  console.log(
    `  source breakdown: optech=${optech.length}, core=${core.length}, ` +
      `knots=${knots.length}, bitcointalk=${talk.length}, ` +
      `mises=${mises.length}, nakamoto=${nakamoto.length}`,
  );
  console.log(
    `  word count: ${totalWords.toLocaleString()} ` +
      `(mises+nakamoto contribute ${countWords([...mises, ...nakamoto]).toLocaleString()})`,
  );
  console.log(
    `Synced public copy → ${PUBLIC_OUTPUT_PATH} (gitignored; the web app fetches it on first load).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
