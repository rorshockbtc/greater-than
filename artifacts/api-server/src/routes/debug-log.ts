/**
 * Dev-only debug-log sink for live chat shit-tests.
 *
 * The chatbot has a lot of internal state — retrieval scores, refusal
 * reasoning, cloud-fallback reasons, persona/system-prompt drift —
 * that the user-visible UI compresses into one chat bubble. When you
 * are stress-testing the bot for 20–30 minutes to find failure modes,
 * the diagnostic gold is in the events the UI throws away.
 *
 * This route accepts a tiny shape — `{ kind, ts, ...payload }` — and
 * appends one NDJSON line per event to `/tmp/chat-debug.ndjson`. The
 * agent can then `tail -f` (or grep) that file in real time without
 * forcing the human to copy-paste anything out of devtools.
 *
 * Hard-gated to NODE_ENV !== 'production'. In production the route
 * 404s so a stray `?debug=1` URL never opens a write channel against
 * a deployed environment.
 */

import { Router, type IRouter } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

const router: IRouter = Router();

// Append-only NDJSON sink. /tmp is fine — the file is meant to be
// read by the agent during the same session it is written; long-term
// retention is a non-goal.
const LOG_PATH = path.join("/tmp", "chat-debug.ndjson");

// One global write queue so concurrent POSTs from a fast-typing user
// (or parallel telemetry events) don't interleave half-lines.
let writeChain: Promise<void> = Promise.resolve();

router.post("/debug-log", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).end();
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const entry = {
    serverTs: new Date().toISOString(),
    ...body,
  };
  // Cap individual entries — a runaway chunk dump shouldn't fill the
  // disk. 16 KiB per event is plenty for a chat turn + retrieval trace.
  const line = JSON.stringify(entry).slice(0, 16 * 1024) + "\n";
  writeChain = writeChain
    .then(() => fs.appendFile(LOG_PATH, line, "utf8"))
    .catch((err) => {
      // Swallow — debug logging must never crash the server.
      console.warn("[debug-log] append failed:", err);
    });
  res.status(204).end();
});

export default router;
