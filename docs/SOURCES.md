# Corpus sources & attribution

The Greater Bitcoin demo bot draws on a curated public-domain and open-licensed corpus. This document lists every source, its author, its license, and the canonical URL the bot links back to when it cites that source.

## Why attribution matters

Two of our largest source institutions — the **Mises Institute** and the **Satoshi Nakamoto Institute** — publish under open licenses precisely because they want curious readers to be sent back to the original material. Citing them well is not just a license requirement; it is an alignment of incentives. Every time the bot links to mises.org or nakamotoinstitute.org, those institutes get a referral and the visitor gets a primary source they can verify. That is the trust loop FOSS-grade RAG was built for.

The bot is instructed in its system prompt to **always link out** to the canonical URL when it draws on Mises or Nakamoto material. This is enforced at the harness layer (`artifacts/emerald/src/data/harness/bitcoinCharter.ts`) and at the per-bias system prompt layer (`data/pipes/bitcoin-greater-v1.manifest.json`).

## Source 1 — Bitcoin OpTech newsletters

- **License:** Open content (bitcoinops.org publishes under permissive terms; full archive is publicly accessible)
- **Source URL:** https://bitcoinops.org/en/newsletters/
- **What it covers:** Every weekly newsletter, full text. Protocol-level technical discussion, BIP discussion, soft-fork activations, fee market mechanics, Lightning Network developments.
- **Bias tag:** `neutral`
- **Source type:** `optech`

## Source 2 — bitcoin/bitcoin commits (last 12 months)

- **License:** MIT (the bitcoin/bitcoin repository is MIT licensed; commit messages are part of the project record)
- **Source URL:** https://github.com/bitcoin/bitcoin
- **What it covers:** Commit messages from the reference implementation. Excludes patches.
- **Bias tag:** `core`
- **Source type:** `github-commit`

## Source 3 — bitcoinknots/bitcoin commits (last 12 months)

- **License:** MIT
- **Source URL:** https://github.com/bitcoinknots/bitcoin
- **What it covers:** Commit messages from Luke Dashjr's Knots fork. Excludes patches.
- **Bias tag:** `knots`
- **Source type:** `github-commit`

## Source 4 — BitcoinTalk threads (curated)

- **License:** BitcoinTalk content is publicly accessible; quoted under fair use for educational and historical reference.
- **Source URL:** https://bitcointalk.org
- **What it covers:** A curated set of historically significant threads (Satoshi's posts, early dev discussion). Configured at `scripts/src/bitcoin-seed/bitcointalk-threads.json`.
- **Bias tag:** `neutral`
- **Source type:** `bitcointalk`

## Source 5 — Mises Institute publications (NEW)

- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0). See https://creativecommons.org/licenses/by/4.0/ — we are free to share and adapt with credit.
- **Source URL:** https://mises.org
- **What it covers:** Foundational Austrian-school works on money, banking, and economic calculation. Curated list at `scripts/src/bitcoin-seed/mises-works.json`. Includes Rothbard's *What Has Government Done to Our Money?* and *The Case Against the Fed*, Mises's *The Theory of Money and Credit*, Hayek's *Use of Knowledge in Society*, Hazlitt's *Economics in One Lesson*, and selected mises.org Wire articles on Bitcoin.
- **Attribution requirement:** Each chunk in the corpus retains its `source_url` (the canonical mises.org page). The bot links to that URL on every citation. No content is republished outside the corpus.
- **Bias tag:** `neutral`
- **Source type:** `mises`

## Source 6 — Nakamoto Institute library (NEW)

- **License:** MIT (per the Satoshi Nakamoto Institute's content license; see https://nakamotoinstitute.org)
- **Source URL:** https://nakamotoinstitute.org/library/
- **What it covers:** The Bitcoin whitepaper, Satoshi's collected forum posts and emails, and the cypherpunk precursor essays — Szabo (*Shelling Out*, *Bit Gold*, *Smart Contracts*), Wei Dai (*b-money*), Hal Finney (*RPOW*), Krawisz (*Hyperbitcoinization*, *Speculative Attack*), Rochard (*The Economics of Bitcoin Mining*). Curated list at `scripts/src/bitcoin-seed/nakamoto-works.json`.
- **Attribution requirement:** Each chunk retains its `source_url` (the canonical nakamotoinstitute.org page). The bot links to that URL on every citation.
- **Bias tag:** `neutral`
- **Source type:** `nakamoto`

## Adding new sources

To add a new Mises or Nakamoto work, edit the corresponding JSON file in `scripts/src/bitcoin-seed/` and re-run `pnpm --filter @workspace/scripts run build-bitcoin-seed`. Each entry needs only `url` and (optionally) `label` + `author`. The build script handles fetching, chunking, and caching — broken URLs are logged and skipped, never breaking the build.

To add a new source type entirely (a new domain or institute), add a new fetcher function to `scripts/src/build-bitcoin-seed.ts` following the pattern of `fetchMisesTexts()` or `fetchNakamotoTexts()`, register the new `source_type` in the `BundleDoc` union, and document it here.

## License compliance summary

| Source | License | Attribution provided by |
|---|---|---|
| OpTech | Open content | `source_url` + `[N]` inline citations |
| bitcoin/bitcoin commits | MIT | `source_url` + commit hash citations |
| bitcoinknots/bitcoin commits | MIT | `source_url` + commit hash citations |
| BitcoinTalk | Fair-use educational | `source_url` |
| Mises Institute | CC BY 4.0 | `source_url` + bot prompt instructs linking to mises.org |
| Nakamoto Institute | MIT | `source_url` + bot prompt instructs linking to nakamotoinstitute.org |

If a rights-holder requests removal of any specific work, open an issue or PR removing the URL from the corresponding JSON config and re-running the build. The next CI rebuild will purge the chunks from the deployed corpus.
