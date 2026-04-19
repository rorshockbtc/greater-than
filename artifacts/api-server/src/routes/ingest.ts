import { Router, type IRouter, type Request, type Response } from "express";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { XMLParser } from "fast-xml-parser";
import rateLimit from "express-rate-limit";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  IngestExtractBody,
  IngestExtractResponse,
  IngestRssBody,
  IngestSitemapBody,
  IngestSitemapResponse,
} from "@workspace/api-zod";
import { isPathAllowed, parseRobotsTxt } from "../lib/robotsTxt";
import {
  DAILY_PAGE_CAP,
  getUsage,
  refundPage,
  reservePages,
} from "../lib/dailyPageCap";

const router: IRouter = Router();

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT =
  "GreaterIngestBot/1.0 (+https://hire.colonhyphenbracket.pink) Readability/1.0";

const ingestLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded; try again in a minute." },
});

const dailyQuotaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 500,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "Daily ingestion quota exceeded for this IP." },
});

router.use("/ingest", ingestLimiter, dailyQuotaLimiter);

/* -------------------------------------------------------------- */
/*  SSRF guard                                                    */
/* -------------------------------------------------------------- */

/**
 * Reject IP literals or DNS results that point at infrastructure the
 * caller has no business reaching from a public scraper:
 *
 *   - loopback (127/8, ::1)
 *   - link-local (169.254/16, fe80::/10)
 *   - private RFC1918 (10/8, 172.16/12, 192.168/16)
 *   - unique-local IPv6 (fc00::/7)
 *   - cloud metadata (169.254.169.254 — covered by link-local above,
 *     but called out here because it is the headline SSRF target)
 *   - 0.0.0.0 / ::, broadcast, multicast
 *
 * IPv4 checks are bitwise on the parsed octets; IPv6 checks compare
 * the canonical address prefix.
 */
function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true; // unparseable → block by default
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 224) return true; // multicast
  if (a >= 240) return true; // reserved / broadcast
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Strip zone identifier ("fe80::1%eth0") if present.
  const bare = lower.split("%")[0]!;
  if (bare === "::" || bare === "::1") return true; // unspecified, loopback
  if (bare.startsWith("fe8") || bare.startsWith("fe9") ||
      bare.startsWith("fea") || bare.startsWith("feb")) return true; // fe80::/10
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true; // fc00::/7 ULA
  if (bare.startsWith("ff")) return true; // multicast ff00::/8
  // IPv4-mapped (::ffff:a.b.c.d) — defer to IPv4 rules.
  const v4Mapped = bare.match(/^::ffff:([0-9.]+)$/);
  if (v4Mapped) return isBlockedIPv4(v4Mapped[1]!);
  return false;
}

interface SafeUrl {
  url: URL;
  resolvedIp: string;
}

/**
 * Validate a user-supplied URL is safe to fetch from this server.
 * Performs the parse + scheme + hostname check, then resolves the
 * hostname and re-checks the resulting IP against the block list.
 *
 * Returns the parsed URL plus the resolved IP so the caller can pass
 * it to fetch() without a second DNS round-trip differing from this
 * one (the classic TOCTOU is a DNS-rebinding host that resolves
 * differently between the check and the actual fetch — `dns.lookup`
 * may use the OS resolver and cache; we accept that small window
 * because nothing in this server reaches sensitive internal targets).
 */
async function resolveSafeUrl(value: string): Promise<SafeUrl | null> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Strip brackets from IPv6 hostnames before passing to the DNS
  // resolver / IP parser.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return null;
  // Block obvious string-form internal hosts before paying for DNS.
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return null;
  }
  // If the host is already an IP literal, validate it directly.
  if (isIP(host)) {
    if (isBlockedIp(host)) return null;
    return { url, resolvedIp: host };
  }
  try {
    const { address } = await dnsLookup(host, { verbatim: true });
    if (isBlockedIp(address)) return null;
    return { url, resolvedIp: address };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- */
/*  Fetch with size + time bounds                                 */
/* -------------------------------------------------------------- */

const MAX_REDIRECTS = 5;

/**
 * Fetch with manual redirect handling so every hop in a redirect chain
 * is re-validated through `resolveSafeUrl`. Default fetch follows
 * 30x's transparently, which would let a public URL bounce to a
 * private/internal address (or AWS metadata) and bypass the SSRF
 * guard. We disable that and walk the chain ourselves.
 */
async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let currentUrl = url;
    let res: Awaited<ReturnType<typeof fetch>> | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(currentUrl, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(init?.headers ?? {}),
        },
      });
      // 3xx with Location → re-validate and continue.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        if (hop === MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        const next = new URL(location, currentUrl).toString();
        const safeNext = await resolveSafeUrl(next);
        if (!safeNext) {
          throw new Error(
            "Refusing to follow redirect to a private or unsafe address",
          );
        }
        currentUrl = safeNext.url.toString();
        // Drain and discard body before the next hop.
        await res.body?.cancel();
        continue;
      }
      break;
    }
    if (!res) throw new Error("No response");
    if (!res.ok) {
      throw new Error(`Upstream responded ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error("Response exceeded max size");
      return { text, finalUrl: currentUrl };
    }
    let total = 0;
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        controller.abort();
        throw new Error("Response exceeded max size");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { text, finalUrl: currentUrl };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------- */
/*  /ingest/extract                                               */
/* -------------------------------------------------------------- */

router.post("/ingest/extract", async (req: Request, res: Response): Promise<void> => {
  const parsed = IngestExtractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const safe = await resolveSafeUrl(parsed.data.url);
  if (!safe) {
    res.status(400).json({ error: "URL must resolve to a public http(s) address" });
    return;
  }

  try {
    const { text: html, finalUrl } = await fetchText(safe.url.toString());
    const dom = new JSDOM(html, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 40) {
      res.status(422).json({
        error:
          "Could not extract readable content. Page may be JS-rendered or paywalled.",
      });
      return;
    }

    const looksJsRendered = /<noscript[^>]*>\s*you need to enable javascript/i.test(html);

    const payload = {
      url: finalUrl,
      title: article.title ?? null,
      byline: article.byline ?? null,
      contentText: article.textContent.replace(/\s+/g, " ").trim(),
      contentHtml: article.content ?? null,
      length: article.length ?? article.textContent.length,
      fetchedAt: new Date(),
      warning: looksJsRendered
        ? "This page appears to be JavaScript-rendered; extracted content may be incomplete."
        : null,
    };
    res.json(IngestExtractResponse.parse(payload));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    res.status(502).json({ error: `Failed to fetch or extract: ${message}` });
  }
});

/* -------------------------------------------------------------- */
/*  /ingest/sitemap                                               */
/* -------------------------------------------------------------- */

interface SitemapNode {
  loc?: string | { "#text"?: string };
  lastmod?: string;
  url?: SitemapNode | SitemapNode[];
  sitemap?: SitemapNode | SitemapNode[];
}

function flattenLoc(node: unknown): string | null {
  if (typeof node === "string") return node.trim();
  if (node && typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    const t = (node as Record<string, unknown>)["#text"];
    return typeof t === "string" ? t.trim() : null;
  }
  return null;
}

function collectUrls(parsed: Record<string, unknown>): {
  pages: string[];
  childSitemaps: string[];
} {
  const pages: string[] = [];
  const childSitemaps: string[] = [];

  const urlset = parsed["urlset"] as { url?: SitemapNode | SitemapNode[] } | undefined;
  if (urlset?.url) {
    const list = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
    for (const entry of list) {
      const loc = flattenLoc(entry.loc);
      if (loc) pages.push(loc);
    }
  }

  const sitemapIndex = parsed["sitemapindex"] as
    | { sitemap?: SitemapNode | SitemapNode[] }
    | undefined;
  if (sitemapIndex?.sitemap) {
    const list = Array.isArray(sitemapIndex.sitemap)
      ? sitemapIndex.sitemap
      : [sitemapIndex.sitemap];
    for (const entry of list) {
      const loc = flattenLoc(entry.loc);
      if (loc) childSitemaps.push(loc);
    }
  }

  return { pages, childSitemaps };
}

router.post("/ingest/sitemap", async (req: Request, res: Response): Promise<void> => {
  const parsed = IngestSitemapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const safe = await resolveSafeUrl(parsed.data.url);
  if (!safe) {
    res.status(400).json({ error: "URL must resolve to a public http(s) address" });
    return;
  }

  const xmlParser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
  });

  const visited = new Set<string>();
  const queue: string[] = [safe.url.toString()];
  const pages = new Set<string>();
  const MAX_PAGES = 5_000;
  const MAX_SITEMAPS = 25;

  try {
    while (queue.length > 0 && visited.size < MAX_SITEMAPS && pages.size < MAX_PAGES) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Re-validate every child sitemap URL — a sitemap index could in
      // principle list internal hosts. Skip-and-continue rather than
      // failing the whole walk so a single bad entry doesn't poison
      // the run.
      const childSafe = current === safe.url.toString()
        ? safe
        : await resolveSafeUrl(current);
      if (!childSafe) continue;

      const { text } = await fetchText(childSafe.url.toString(), {
        headers: { accept: "application/xml,text/xml,*/*;q=0.8" },
      });
      const doc = xmlParser.parse(text) as Record<string, unknown>;
      const { pages: ps, childSitemaps } = collectUrls(doc);
      for (const p of ps) {
        if (pages.size >= MAX_PAGES) break;
        pages.add(p);
      }
      for (const s of childSitemaps) {
        if (!visited.has(s)) queue.push(s);
      }
    }

    res.json(
      IngestSitemapResponse.parse({
        sourceUrl: safe.url.toString(),
        urls: Array.from(pages),
        truncated: pages.size >= MAX_PAGES || visited.size >= MAX_SITEMAPS,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sitemap fetch failed";
    res.status(502).json({ error: `Failed to parse sitemap: ${message}` });
  }
});

/* -------------------------------------------------------------- */
/*  /ingest/rss  (RSS 2.0 + Atom 1.0)                             */
/* -------------------------------------------------------------- */

interface RssItem {
  link?: unknown;
  guid?: unknown;
}
interface AtomEntry {
  link?: unknown;
  id?: unknown;
}

/**
 * Pull an http(s) URL out of either RSS's `<link>text</link>` form or
 * Atom's `<link href="...">` form (which fast-xml-parser surfaces as
 * either a string or an array of objects with `@_href` keys depending
 * on the document — but with `ignoreAttributes: true` we only get the
 * first link's text).
 */
function flattenLink(node: unknown): string | null {
  if (typeof node === "string") {
    const t = node.trim();
    return t || null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const got = flattenLink(item);
      if (got) return got;
    }
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const text = obj["#text"];
    if (typeof text === "string" && text.trim()) return text.trim();
    const href = obj["@_href"];
    if (typeof href === "string" && href.trim()) return href.trim();
  }
  return null;
}

function collectFeedUrls(doc: Record<string, unknown>): string[] {
  const out: string[] = [];

  // RSS 2.0: rss → channel → item[]
  const rss = doc["rss"] as { channel?: { item?: RssItem | RssItem[] } } | undefined;
  if (rss?.channel?.item) {
    const items = Array.isArray(rss.channel.item) ? rss.channel.item : [rss.channel.item];
    for (const item of items) {
      const link = flattenLink(item.link) ?? flattenLink(item.guid);
      if (link) out.push(link);
    }
  }

  // Atom 1.0: feed → entry[]
  const feed = doc["feed"] as { entry?: AtomEntry | AtomEntry[] } | undefined;
  if (feed?.entry) {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    for (const entry of entries) {
      const link = flattenLink(entry.link) ?? flattenLink(entry.id);
      if (link) out.push(link);
    }
  }

  return out;
}

router.post("/ingest/rss", async (req: Request, res: Response): Promise<void> => {
  const parsed = IngestRssBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const safe = await resolveSafeUrl(parsed.data.url);
  if (!safe) {
    res.status(400).json({ error: "URL must resolve to a public http(s) address" });
    return;
  }

  const MAX_ENTRIES = 500;

  try {
    const { text } = await fetchText(safe.url.toString(), {
      headers: { accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    const xmlParser = new XMLParser({
      // Atom puts its href in an attribute; we explicitly need it.
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
    });
    const doc = xmlParser.parse(text) as Record<string, unknown>;
    const links = collectFeedUrls(doc);

    if (links.length === 0) {
      res.status(422).json({
        error: "Feed parsed but no entries with links were found (not a valid RSS or Atom feed?).",
      });
      return;
    }

    const trimmed = links.slice(0, MAX_ENTRIES);
    res.json(
      IngestSitemapResponse.parse({
        sourceUrl: safe.url.toString(),
        urls: trimmed,
        truncated: links.length > MAX_ENTRIES,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feed fetch failed";
    res.status(502).json({ error: `Failed to parse feed: ${message}` });
  }
});

/* -------------------------------------------------------------- */
/*  /ingest/crawl  (NDJSON-streaming site walk)                   */
/* -------------------------------------------------------------- */

/**
 * Crawl request body. Tight upper bounds because we are running on
 * shared infrastructure and a careless input would saturate it.
 *
 * - `maxPages`: hard cap on pages fetched in this single crawl.
 * - `maxDepth`: link-graph depth from the root, where the root is 0.
 * - `delayMs`: polite delay between page fetches. We do NOT skip the
 *   delay even when fetches fail — the client signaled "be polite",
 *   and an error response can still imply load on the upstream.
 *
 * Validated inline rather than via the @workspace/api-zod codegen
 * because `/ingest/crawl` returns a NDJSON stream — orval doesn't
 * model streaming responses, and the front-end consumes the stream
 * with raw `fetch` for the same reason.
 */
interface IngestCrawlInput {
  root: string;
  maxPages: number;
  maxDepth: number;
  delayMs: number;
}

function parseCrawlBody(raw: unknown): IngestCrawlInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Body must be a JSON object." };
  const obj = raw as Record<string, unknown>;
  const root = obj["root"];
  if (typeof root !== "string" || !root.trim()) {
    return { error: "`root` must be a non-empty string URL." };
  }
  const maxPages = clampInt(obj["maxPages"], 1, 200, 50);
  const maxDepth = clampInt(obj["maxDepth"], 0, 4, 2);
  const delayMs = clampInt(obj["delayMs"], 0, 10_000, 1_000);
  return { root, maxPages, maxDepth, delayMs };
}

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < lo) return lo;
  if (i > hi) return hi;
  return i;
}

/**
 * Stream a NewlineDelimited JSON event. We flush after each line so
 * the browser orchestrator sees progress in real time rather than in
 * one buffered burst at the end.
 */
function emit(res: Response, event: Record<string, unknown>): void {
  res.write(JSON.stringify(event) + "\n");
}

/**
 * Same-origin link extractor. We ONLY follow links whose URL.origin
 * matches the root — this keeps the crawler bounded and prevents it
 * from wandering into ad networks or analytics domains via embedded
 * 3p anchors.
 */
function extractSameOriginLinks(
  html: string,
  baseUrl: string,
  rootOrigin: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Cheap regex pass — JSDOM is already involved in the extract
  // step but here we only care about anchors and we don't want a
  // second full DOM build per page.
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  for (let m: RegExpExecArray | null; (m = re.exec(html)); ) {
    const href = m[1];
    if (!href) continue;
    if (href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    let next: URL;
    try {
      next = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (next.origin !== rootOrigin) continue;
    // Drop the fragment — same page from a crawl perspective.
    next.hash = "";
    const norm = next.toString();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

interface QueueItem {
  url: string;
  depth: number;
}

router.post("/ingest/crawl", async (req: Request, res: Response): Promise<void> => {
  const parsed = parseCrawlBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const safeRoot = await resolveSafeUrl(parsed.root);
  if (!safeRoot) {
    res.status(400).json({ error: "Root URL must resolve to a public http(s) address" });
    return;
  }

  const ip = req.ip ?? "unknown";
  const usageBefore = getUsage(ip);
  if (usageBefore.used >= DAILY_PAGE_CAP) {
    res.status(429).json({
      error: "Daily crawl page-count cap exceeded for this IP.",
      cap: DAILY_PAGE_CAP,
      used: usageBefore.used,
      resetsInMs: usageBefore.resetsInMs,
    });
    return;
  }

  // From here on we stream NDJSON. Set headers BEFORE the first
  // write so the client knows what to parse.
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders?.();

  const rootUrl = safeRoot.url;
  const rootOrigin = rootUrl.origin;
  const { maxPages, maxDepth, delayMs } = parsed;

  // Track per-IP cap remaining for THIS crawl. We pre-reserve the
  // smaller of (maxPages, remaining-quota) up-front, then refund as
  // we go if we skip pages for non-fetch reasons. This avoids a slow
  // crawl being interrupted by a sibling request landing the cap.
  const granted = reservePages(ip, Math.min(maxPages, DAILY_PAGE_CAP));
  if (granted === 0) {
    emit(res, { event: "error", message: "Daily page cap reached." });
    res.end();
    return;
  }
  const localCap = granted;

  // Cancellation: if the client hangs up (browser AbortController),
  // bail out of the crawl loop ASAP.
  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  // robots.txt — best-effort. If we can't fetch it (404, timeout,
  // upstream 5xx) we treat it as fully permissive, which matches how
  // most polite crawlers behave.
  let robotsRules = parseRobotsTxt("");
  try {
    const robotsUrl = `${rootOrigin}/robots.txt`;
    const safeRobots = await resolveSafeUrl(robotsUrl);
    if (safeRobots) {
      const { text } = await fetchText(safeRobots.url.toString(), {
        headers: { accept: "text/plain,*/*;q=0.8" },
      });
      robotsRules = parseRobotsTxt(text);
    }
  } catch {
    // Permissive on failure.
  }

  // Sitemap-first seeding: try `<root>/sitemap.xml`. If it resolves
  // and parses, queue every same-origin URL it lists at depth 1
  // (depth 0 is reserved for the root itself). Failure is silent —
  // the crawl falls back to pure BFS.
  const queue: QueueItem[] = [{ url: rootUrl.toString(), depth: 0 }];
  try {
    const sitemapUrl = `${rootOrigin}/sitemap.xml`;
    const safeSitemap = await resolveSafeUrl(sitemapUrl);
    if (safeSitemap) {
      const { text } = await fetchText(safeSitemap.url.toString(), {
        headers: { accept: "application/xml,text/xml,*/*;q=0.8" },
      });
      const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });
      const doc = xmlParser.parse(text) as Record<string, unknown>;
      const { pages } = collectUrls(doc);
      for (const p of pages) {
        try {
          if (new URL(p).origin === rootOrigin) {
            queue.push({ url: p, depth: 1 });
          }
        } catch {
          // skip malformed
        }
      }
    }
  } catch {
    // No sitemap — fall back to pure BFS.
  }

  const enqueued = new Set<string>(queue.map((q) => q.url));
  const fetched = new Set<string>();
  let pagesFetched = 0;
  let pagesUsed = 0; // counts toward localCap; only successful fetches

  // Tell the client the discovery phase has primed the queue.
  emit(res, {
    event: "queued",
    discovered: queue.length,
    fromSitemap: queue.length > 1,
  });

  for (let i = 0; i < queue.length; i++) {
    if (aborted) break;
    if (pagesUsed >= localCap) break;
    if (pagesFetched >= maxPages) break;
    const item = queue[i]!;
    if (fetched.has(item.url)) continue;
    fetched.add(item.url);

    let pageUrl: URL;
    try {
      pageUrl = new URL(item.url);
    } catch {
      continue;
    }

    if (!isPathAllowed(robotsRules, pageUrl.pathname + pageUrl.search)) {
      emit(res, {
        event: "skipped",
        url: item.url,
        reason: "robots.txt disallows this path.",
      });
      continue;
    }

    // Re-validate every URL through the SSRF guard — sitemap entries
    // and href targets are user-influenced.
    const safe = await resolveSafeUrl(item.url);
    if (!safe) {
      emit(res, {
        event: "error",
        url: item.url,
        message: "URL did not resolve to a safe public address.",
      });
      continue;
    }

    pagesUsed += 1;
    emit(res, {
      event: "discovered",
      url: item.url,
      depth: item.depth,
      index: pagesFetched,
    });

    try {
      const { text: html, finalUrl } = await fetchText(safe.url.toString());
      const dom = new JSDOM(html, { url: finalUrl });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      const contentText =
        article?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const title = article?.title ?? null;
      pagesFetched += 1;
      emit(res, {
        event: "fetched",
        url: finalUrl,
        title,
        contentText,
        length: contentText.length,
        index: pagesFetched - 1,
      });

      // Discover more links — only if we still have budget AND we
      // haven't hit max depth. Otherwise it's wasted work.
      if (item.depth < maxDepth && pagesFetched < maxPages) {
        const links = extractSameOriginLinks(html, finalUrl, rootOrigin);
        let added = 0;
        for (const link of links) {
          if (queue.length - i >= maxPages * 4) break; // bound queue
          if (!enqueued.has(link)) {
            enqueued.add(link);
            queue.push({ url: link, depth: item.depth + 1 });
            added += 1;
          }
        }
        if (added > 0) {
          emit(res, { event: "queued", discovered: enqueued.size });
        }
      }
    } catch (err) {
      // Page failed — refund the budget slot so a 404-heavy site
      // doesn't drain the per-IP daily cap on errors alone.
      refundPage(ip);
      pagesUsed -= 1;
      emit(res, {
        event: "error",
        url: item.url,
        message: err instanceof Error ? err.message : "Fetch failed",
      });
    }

    if (delayMs > 0 && !aborted && i + 1 < queue.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Refund any pre-reserved slots we didn't actually use.
  const unused = localCap - pagesUsed;
  for (let k = 0; k < unused; k++) refundPage(ip);

  emit(res, {
    event: "done",
    pagesFetched,
    discovered: enqueued.size,
    aborted,
    capUsed: getUsage(ip).used,
    capLimit: DAILY_PAGE_CAP,
  });
  res.end();
});

export default router;
