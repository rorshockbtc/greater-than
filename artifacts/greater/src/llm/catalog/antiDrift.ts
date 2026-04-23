/**
 * Anti-drift gate for the Bitcoin catalog (Task #68).
 *
 * Three deterministic checks run BEFORE the navigator descends the
 * catalog tree:
 *
 *   1. Shitcoin probe — explicit altcoin mentions ("ethereum",
 *      "solana", "doge", …) trigger a curt redirect that names the
 *      asset and the catalog's actual scope. The model is never
 *      consulted; the response is canned.
 *   2. Scam / hype-cycle probe — "to the moon", "100x", "when lambo",
 *      airdrop / presale framing. Treated as off-topic for an
 *      operational Bitcoin assistant; redirected to the spirit of
 *      the catalog (sound money, technical reality).
 *   3. Financial-advice probe — "should I buy", "is it a good time",
 *      "price prediction". The bot has no business answering these
 *      and saying so plainly is a feature of the persona.
 *
 * Why deterministic: a probabilistic LLM gate would sometimes engage
 * with these queries on a tangent and quietly recommend a shitcoin.
 * A keyword regex never does. False positives (legitimate question
 * that happens to mention "ethereum" in passing) are acceptable —
 * the redirect text is short, friendly, and explains the scope.
 *
 * Hidden in this file are the actual response templates; the caller
 * (navigator.ts) just receives a ready-to-render string.
 */

export type DriftKind = "shitcoin" | "scam" | "advice" | null;

/**
 * Match whole-word so that "ethernet" doesn't trigger the "ETH" rule
 * and "doge" inside "dogecoin" doesn't double-fire. Generated via
 * `\b…\b` boundaries. Kept tight — overreach trains visitors that
 * the bot is hostile.
 */
const SHITCOIN_RE =
  /\b(eth|ethereum|sol|solana|ada|cardano|doge(?:coin)?|shitcoin|altcoin|nft|defi|memecoin|xrp|ripple|bnb|binance\s?coin|usdt|tether|usdc|stablecoin|polkadot|avalanche|tron|chainlink|monero|xmr|litecoin|ltc|bitcoin\s?cash|bch|bsv)\b/i;

const SCAM_RE =
  /\b(to\s+the\s+moon|when\s+lambo|100x|10x|1000x|presale|airdrop|rug(?:\s?pull)?|ponzi|pump|shill|degen)\b/i;

const ADVICE_RE =
  /\b(should\s+i\s+(buy|sell|invest|hold|stack|take\s+out|borrow|put|use\s+leverage)|is\s+(it|now|today)\s+(a\s+)?good\s+time|price\s+(prediction|target|forecast)|will\s+(btc|bitcoin|the\s+price)\s+(hit|reach|go|moon|crash)|how\s+much\s+will\s+(btc|bitcoin)\s+be\s+worth|take\s+out\s+a?\s*(loan|heloc|mortgage|line\s+of\s+credit)|use\s+leverage|put\s+my\s+(paycheck|salary|savings|life\s+savings)|(buy|sell)\s+the\s+(dip|top)|when\s+to\s+(buy|sell))\b/i;

export interface DriftDetection {
  kind: DriftKind;
  /** The matched substring, useful for telemetry / logging. */
  match?: string;
}

export function detectDrift(query: string): DriftDetection {
  const shit = query.match(SHITCOIN_RE);
  if (shit) return { kind: "shitcoin", match: shit[0] };
  const scam = query.match(SCAM_RE);
  if (scam) return { kind: "scam", match: scam[0] };
  const adv = query.match(ADVICE_RE);
  if (adv) return { kind: "advice", match: adv[0] };
  return { kind: null };
}

/**
 * Render the redirect text.
 *
 * The redirect has two jobs and they fight each other:
 *
 *   1. Honestly tell the visitor what's out of scope (so they don't
 *      think the bot is broken).
 *   2. NOT cower. A bot that just says "I can't help with that" feels
 *      weak — and weak is the kiss of death for a support bot. Every
 *      refusal is also an opportunity to demonstrate fluency on the
 *      topics the bot CAN go deep on.
 *
 * So the shape is always: name the thing that's off-topic, name the
 * scope plainly, then offer 2–4 concrete paths inside the scope and
 * ask the visitor to pick. When the catalog supplies `suggestedPaths`
 * the bot offers them by name; when it doesn't, the bot offers a
 * generic "what were you trying to figure out?" prompt.
 *
 * Mentions the matched asset by name so the response doesn't read like
 * a generic deflection — visitors who asked about ETH on purpose
 * deserve to know the bot actually parsed their question.
 */
export function renderDriftRedirect(
  detection: DriftDetection,
  topicalAnchor: string,
  suggestedPaths?: string[],
): string {
  /**
   * Render the "pick a path" tail consistently across all three drift
   * kinds. When the catalog gave us paths, the bot offers them as a
   * small bullet list and asks for a pick. Otherwise it asks an open
   * question.
   */
  const renderPathOffer = (lead: string): string => {
    if (suggestedPaths && suggestedPaths.length > 0) {
      const bullets = suggestedPaths.map((p) => `  • ${p}`).join("\n");
      return `${lead}\n\n${bullets}\n\nWhich one?`;
    }
    return `${lead} What were you actually trying to figure out?`;
  };

  if (detection.kind === "shitcoin") {
    return [
      `I don't study ${detection.match ?? "altcoins"} — this catalog is ${topicalAnchor}, on purpose.`,
      "",
      renderPathOffer(
        "Pick a path and I'll go deep — I'm built to hammer these down:",
      ),
    ].join("\n");
  }
  if (detection.kind === "scam") {
    return [
      `That framing isn't what this assistant is for. I cover ${topicalAnchor} — the monetary thesis, how the protocol actually works, and how to hold keys safely.`,
      "",
      renderPathOffer(
        "If there's a real underlying question, I can take it from one of these angles:",
      ),
    ].join("\n");
  }
  if (detection.kind === "advice") {
    return [
      "I don't give buy/sell/timing advice — that's not a thing a small support bot can answer responsibly, and anyone who claims they can is either guessing or selling something.",
      "",
      renderPathOffer(
        `What I CAN do is explain ${topicalAnchor}. Pick a path:`,
      ),
    ].join("\n");
  }
  // Defensive: caller should not reach here when kind === null.
  return `I'm scoped to ${topicalAnchor}.`;
}
