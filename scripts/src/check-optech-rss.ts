/**
 * Check for a new Bitcoin OpTech newsletter and, if found, fetch it and write
 * the full text to scripts/src/bitcoin-seed/optech/<YYYY-MM-DD>.txt.
 *
 * Called by the `optech-rss-pr.yml` GitHub Actions workflow (Mon + Thu).
 * Outputs two GitHub Actions output variables via $GITHUB_OUTPUT:
 *   new_issue_url   — the canonical URL of the new issue, or empty string
 *   new_issue_date  — YYYY-MM-DD, or empty string
 *
 * Tracking file: scripts/src/bitcoin-seed/.last-optech-issue
 *   Contains the YYYY-MM-DD date of the last known newsletter.
 *   On first run the file is absent; the script writes the most-recent
 *   date as baseline and exits without signalling a new issue (to avoid
 *   a giant first PR covering all historical newsletters).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../");
const OPTECH_DIR = path.join(REPO_ROOT, "scripts/src/bitcoin-seed/optech");
const TRACKING_FILE = path.join(
  REPO_ROOT,
  "scripts/src/bitcoin-seed/.last-optech-issue",
);
const NEWSLETTER_INDEX = "https://bitcoinops.org/en/newsletters/";
const NEWSLETTER_URL_RE =
  /^https:\/\/bitcoinops\.org\/en\/newsletters\/(\d{4})\/(\d{2})\/(\d{2})\/?$/;
const UA =
  "GreaterOpTechBot/1.0 (+https://hire.colonhyphenbracket.pink) Readability/1.0";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function extractText(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article || !article.textContent) return null;
  return article.textContent.replace(/\s+/g, " ").trim();
}

function setOutput(name: string, value: string) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `${name}=${value}\n`);
  } else {
    console.log(`OUTPUT ${name}=${value}`);
  }
}

async function main() {
  console.log("Fetching OpTech newsletter index…");
  const indexHtml = await fetchText(NEWSLETTER_INDEX);
  const dom = new JSDOM(indexHtml, { url: NEWSLETTER_INDEX });
  const links = Array.from(
    dom.window.document.querySelectorAll("a[href^='/en/newsletters/']"),
  )
    .map((a) => {
      const el = a as HTMLAnchorElement;
      const href = el.getAttribute("href") ?? "";
      return href.startsWith("http")
        ? href
        : `https://bitcoinops.org${href}`;
    })
    .filter((href) => NEWSLETTER_URL_RE.test(href.replace(/\/$/, "")));

  const unique = Array.from(new Set(links))
    .map((u) => u.replace(/\/$/, ""))
    .sort()
    .reverse();
  console.log(`  ${unique.length} newsletters found.`);

  if (unique.length === 0) {
    console.log("No newsletters found — exiting.");
    setOutput("new_issue_url", "");
    setOutput("new_issue_date", "");
    return;
  }

  const latestUrl = unique[0]!;
  const match = latestUrl.match(NEWSLETTER_URL_RE);
  const latestDate = match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  if (!latestDate) throw new Error(`Could not parse date from ${latestUrl}`);

  console.log(`Latest newsletter: ${latestDate} — ${latestUrl}`);

  let lastKnown: string | null = null;
  if (existsSync(TRACKING_FILE)) {
    lastKnown = (await readFile(TRACKING_FILE, "utf8")).trim();
    console.log(`Last known issue: ${lastKnown}`);
  } else {
    console.log(
      "No tracking file found — first run. Writing baseline without signalling a new issue.",
    );
    await writeFile(TRACKING_FILE, latestDate + "\n", "utf8");
    setOutput("new_issue_url", "");
    setOutput("new_issue_date", "");
    return;
  }

  if (lastKnown === latestDate) {
    console.log("No new newsletters since last run.");
    setOutput("new_issue_url", "");
    setOutput("new_issue_date", "");
    return;
  }

  console.log(`New newsletter detected: ${latestDate}`);

  await mkdir(OPTECH_DIR, { recursive: true });

  console.log(`  Fetching ${latestUrl}…`);
  const html = await fetchText(latestUrl);
  const body = extractText(html, latestUrl);

  if (!body) {
    throw new Error(`Readability could not extract text from ${latestUrl}`);
  }

  const content = `# OpTech Newsletter ${latestDate}\n\nSource: ${latestUrl}\n\n${body}`;
  const outPath = path.join(OPTECH_DIR, `${latestDate}.txt`);
  await writeFile(outPath, content, "utf8");
  console.log(`  Written to ${path.relative(REPO_ROOT, outPath)}`);

  await writeFile(TRACKING_FILE, latestDate + "\n", "utf8");
  console.log(`  Tracking file updated to ${latestDate}`);

  setOutput("new_issue_url", latestUrl);
  setOutput("new_issue_date", latestDate);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
