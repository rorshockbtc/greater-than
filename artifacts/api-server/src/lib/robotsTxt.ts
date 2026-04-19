/**
 * Tiny robots.txt parser used by the site crawler.
 *
 * We honor the union of the rules under our User-agent (the
 * GreaterIngestBot UA used by `fetchText`) and the `*` wildcard
 * group. Matching is the lightweight prefix match described in the
 * original RFC: a path is disallowed iff it starts with one of the
 * `Disallow:` prefixes for the matching group AND is not overridden
 * by a longer-prefix `Allow:` rule for the same group.
 *
 * This is deliberately not a full parser — we don't honor wildcards
 * (`*`, `$`), Crawl-delay, Sitemap, or per-host overrides. It's good
 * enough to be a polite citizen on the public web while keeping the
 * crawler's surface area small. If a site needs something fancier,
 * the answer is "give us the sitemap URL directly".
 */

export interface RobotsRules {
  /**
   * Ordered list of rules. We keep them ordered so that "longest
   * matching prefix wins" can be implemented with a simple linear
   * scan. Each entry is the path prefix and whether it's allow/deny.
   */
  rules: Array<{ prefix: string; allow: boolean }>;
}

const OUR_UA = "greateringestbot";

export function parseRobotsTxt(body: string): RobotsRules {
  const lines = body.split(/\r?\n/);
  // We collect rules per active group; only commit them to the final
  // output once we know the group applies to us. A group continues
  // until the next `User-agent:` after at least one rule has been
  // seen.
  let activeAgents: string[] = [];
  let groupRules: Array<{ prefix: string; allow: boolean }> = [];
  let inRule = false;
  const out: Array<{ prefix: string; allow: boolean }> = [];

  const commitGroup = () => {
    if (!activeAgents.length || !groupRules.length) return;
    const matches = activeAgents.some(
      (a) => a === "*" || a === OUR_UA,
    );
    if (matches) out.push(...groupRules);
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sepIdx = line.indexOf(":");
    if (sepIdx < 0) continue;
    const field = line.slice(0, sepIdx).trim().toLowerCase();
    const value = line.slice(sepIdx + 1).trim();
    if (field === "user-agent") {
      // A new User-agent line after a rule means: previous group is
      // closed, start a new one. Multiple UA lines back-to-back
      // before any rule means: this group covers all of them.
      if (inRule) {
        commitGroup();
        activeAgents = [];
        groupRules = [];
        inRule = false;
      }
      activeAgents.push(value.toLowerCase());
    } else if (field === "disallow") {
      inRule = true;
      // An empty `Disallow:` is the explicit "allow everything" form
      // — represent it as an allow rule on the root prefix so it can
      // shadow any later rules in this group.
      if (!value) {
        groupRules.push({ prefix: "/", allow: true });
      } else {
        groupRules.push({ prefix: value, allow: false });
      }
    } else if (field === "allow") {
      inRule = true;
      if (value) groupRules.push({ prefix: value, allow: true });
    }
    // Other fields (Sitemap, Crawl-delay, Host, etc.) are ignored.
  }
  commitGroup();
  return { rules: out };
}

/**
 * Check whether the given URL path is allowed under the rules. A
 * path is allowed iff no Disallow prefix matches it OR the longest
 * matching Allow prefix is at least as long as the longest matching
 * Disallow prefix (the conventional "specificity wins" tiebreak).
 */
export function isPathAllowed(rules: RobotsRules, pathname: string): boolean {
  let bestAllow = -1;
  let bestDeny = -1;
  for (const r of rules.rules) {
    if (!pathname.startsWith(r.prefix)) continue;
    if (r.allow) {
      if (r.prefix.length > bestAllow) bestAllow = r.prefix.length;
    } else {
      if (r.prefix.length > bestDeny) bestDeny = r.prefix.length;
    }
  }
  if (bestDeny < 0) return true;
  return bestAllow >= bestDeny;
}
