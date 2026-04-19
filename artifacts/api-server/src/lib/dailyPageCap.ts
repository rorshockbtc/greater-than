/**
 * Per-IP daily page-fetch cap for the crawler.
 *
 * The existing `express-rate-limit` middleware caps *requests* (one
 * crawl call per request), but each crawl can fetch dozens to
 * hundreds of pages. We need a separate budget that counts pages
 * actually retrieved by the crawler so a single client can't drain
 * the server with one giant crawl per minute.
 *
 * This is a plain in-memory counter — fine for a single-process
 * deployment of the kind this project ships. A horizontally-scaled
 * deployment would need a shared store (Redis / Postgres) but that's
 * out of scope here.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public per-IP daily allowance. Sized so that an aggressive crawler
 * can index a small site (a personal blog, a docs site) end-to-end
 * within one day, but cannot abuse the server as a generic scraper
 * with effectively unlimited bandwidth.
 */
export const DAILY_PAGE_CAP = 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function bucketFor(ip: string): Bucket {
  const now = Date.now();
  const existing = buckets.get(ip);
  if (existing && existing.resetAt > now) return existing;
  const fresh: Bucket = { count: 0, resetAt: now + DAY_MS };
  buckets.set(ip, fresh);
  return fresh;
}

/** Pages already used in the current 24h window for this IP. */
export function getUsage(ip: string): { used: number; limit: number; resetsInMs: number } {
  const b = bucketFor(ip);
  return {
    used: b.count,
    limit: DAILY_PAGE_CAP,
    resetsInMs: Math.max(0, b.resetAt - Date.now()),
  };
}

/**
 * Reserve `n` page slots for this IP. Returns the number of slots
 * actually granted (may be < n when the daily cap is approaching).
 * Caller should treat 0 as "you're done for the day".
 */
export function reservePages(ip: string, n: number): number {
  const b = bucketFor(ip);
  const remaining = Math.max(0, DAILY_PAGE_CAP - b.count);
  const granted = Math.min(remaining, n);
  b.count += granted;
  return granted;
}

/**
 * Release a previously-reserved slot when the page wasn't actually
 * fetched (e.g. SSRF rejection, robots.txt deny). Lets the IP
 * recover budget for legitimate fetches that simply chose not to
 * happen.
 */
export function refundPage(ip: string): void {
  const b = bucketFor(ip);
  if (b.count > 0) b.count -= 1;
}
