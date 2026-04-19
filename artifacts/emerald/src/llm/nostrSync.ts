/**
 * NOSTR relay sync — ingests knowledge from a NOSTR relay into the
 * Greater in-browser vector store.
 *
 * Philosophy
 * ----------
 * NOSTR's event model maps perfectly onto Greater's chunked knowledge
 * pipeline: each event is a discrete piece of content, the author's
 * pubkey is the provenance, and the event ID is a stable dedup key.
 * By subscribing to a private relay the operator controls, a business
 * can stream knowledge updates without uploading anything to a third
 * party.
 *
 * Decryption
 * ----------
 * Two modes:
 *   1. NIP-07 (window.nostr) — the user's browser extension (Alby,
 *      nos2x, etc.) handles decryption. The private key never enters
 *      Greater's code. This is the recommended path.
 *   2. In-memory nsec — the user pastes their nsec into the panel.
 *      It is kept only in the React component's state and never
 *      persisted to localStorage, IndexedDB, or sent over the network.
 *
 * Event kinds supported
 * ----------------------
 *   Kind 1  — Short text notes (encrypted or plain).
 *   Kind 30023 — Long-form articles (NIP-23), encrypted or plain.
 *   Kind 4   — Encrypted direct messages (NIP-04). Treated as private
 *              knowledge when the recipient is the same pubkey.
 *
 * All decryption is NIP-04 (shared-secret AES-256-CBC). NIP-44 is not
 * yet supported — open an issue if you need it.
 */

import { SimplePool } from "nostr-tools/pool";
import { nip04, nip19 } from "nostr-tools";
import type { Event, Filter } from "nostr-tools";
import { chunkText } from "./chunker";
import { putChunkWithVector } from "./vectorStore";
import type { EmbedFn } from "./ingest";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface NostrSyncOptions {
  /** One or more WSS relay URLs, e.g. ["wss://relay.damus.io"]. */
  relayUrls: string[];
  /**
   * Hex or npub of the pubkey whose events we want to index.
   * Defaults to the authenticated pubkey when using NIP-07.
   */
  targetPubkey?: string;
  /**
   * If true, attempt to decrypt events tagged as private.
   * Requires either `nsecHex` or window.nostr (NIP-07).
   */
  decryptPrivate?: boolean;
  /**
   * In-memory nsec (hex or bech32). Never stored. Used only when
   * window.nostr is unavailable. Handle with care.
   */
  nsecHex?: string;
  /** Max events to pull per subscription (safety cap). */
  limit?: number;
  embed: EmbedFn;
  onProgress?: (msg: string, done: number, total: number) => void;
}

export interface NostrSyncResult {
  events_fetched: number;
  chunks_indexed: number;
  skipped: number;
}

function npubToHex(pubkey: string): string {
  if (pubkey.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(pubkey);
      if (decoded.type === "npub") return decoded.data as string;
    } catch {}
  }
  return pubkey;
}

function nsecToHex(nsec: string): string {
  if (nsec.startsWith("nsec1")) {
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type === "nsec") return bytesToHex(decoded.data as Uint8Array);
    } catch {}
  }
  return nsec;
}

type Nip07Window = {
  nostr?: {
    getPublicKey?: () => Promise<string>;
    nip04?: {
      decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
    };
  };
};

async function decryptContent(
  event: Event,
  ownerPubkeyHex: string,
  nsecHex?: string,
): Promise<string | null> {
  const content = event.content;
  if (!content) return null;

  const w = window as unknown as Nip07Window;
  if (typeof window !== "undefined" && w.nostr?.nip04) {
    try {
      const senderPubkey =
        event.pubkey === ownerPubkeyHex ? ownerPubkeyHex : event.pubkey;
      return await w.nostr.nip04.decrypt(senderPubkey, content);
    } catch {
      return null;
    }
  }

  if (nsecHex) {
    try {
      const senderPubkey =
        event.pubkey === ownerPubkeyHex ? ownerPubkeyHex : event.pubkey;
      return await nip04.decrypt(nsecHex, senderPubkey, content);
    } catch {
      return null;
    }
  }

  return null;
}

function eventLabel(event: Event): string {
  const titleTag = event.tags?.find((t) => t[0] === "title");
  if (titleTag?.[1]) return titleTag[1];
  const subjectTag = event.tags?.find((t) => t[0] === "subject");
  if (subjectTag?.[1]) return subjectTag[1];
  const preview = event.content.slice(0, 60).replace(/\s+/g, " ").trim();
  return preview ? `${preview}…` : `event:${event.id.slice(0, 8)}`;
}

export async function syncNostr(
  jobId: string,
  options: NostrSyncOptions,
): Promise<NostrSyncResult> {
  const {
    relayUrls,
    decryptPrivate = false,
    nsecHex: rawNsec,
    limit = 200,
    embed,
    onProgress,
  } = options;

  const nsecHex = rawNsec ? nsecToHex(rawNsec) : undefined;

  let resolvedPubkeyHex: string | undefined = options.targetPubkey
    ? npubToHex(options.targetPubkey)
    : undefined;

  if (!resolvedPubkeyHex) {
    const w = window as unknown as Nip07Window;
    if (w.nostr?.getPublicKey) {
      try {
        resolvedPubkeyHex = await w.nostr.getPublicKey();
      } catch {
        throw new Error(
          "Could not get public key from browser extension. Provide a target pubkey or npub manually.",
        );
      }
    } else {
      throw new Error(
        "No target pubkey provided and no NIP-07 extension found. Install Alby or nos2x, or enter an npub manually.",
      );
    }
  }

  const pool = new SimplePool();
  let events_fetched = 0;
  let chunks_indexed = 0;
  let skipped = 0;

  try {
    const filters: Filter[] = [
      {
        authors: [resolvedPubkeyHex],
        kinds: [1, 30023],
        limit,
      },
    ];

    if (decryptPrivate) {
      filters.push({
        kinds: [4],
        "#p": [resolvedPubkeyHex],
        limit,
      });
    }

    const events = await pool.querySync(relayUrls, filters[0]!);
    if (decryptPrivate && filters[1]) {
      const dmEvents = await pool.querySync(relayUrls, filters[1]);
      events.push(...dmEvents);
    }

    events_fetched = events.length;
    onProgress?.("Fetched events", 0, events_fetched);

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      let contentText = "";

      const isEncrypted =
        event.kind === 4 ||
        event.tags?.some((t) => t[0] === "encrypted");

      if (isEncrypted && decryptPrivate) {
        const decrypted = await decryptContent(
          event,
          resolvedPubkeyHex,
          nsecHex,
        );
        if (!decrypted) {
          skipped++;
          onProgress?.(
            `Skipped encrypted event (no key)`,
            i + 1,
            events_fetched,
          );
          continue;
        }
        contentText = decrypted;
      } else if (!isEncrypted) {
        contentText = event.content;
      } else {
        skipped++;
        continue;
      }

      if (!contentText.trim() || contentText.trim().length < 30) {
        skipped++;
        continue;
      }

      const label = eventLabel(event);
      const eventUrl = `nostr:${event.id}`;
      const chunks = chunkText(contentText);

      for (const chunk of chunks) {
        const chunkId = `${jobId}::nostr-${event.id}#${chunk.chunk_index}`;
        const vec = await embed(chunk.text);
        await putChunkWithVector(
          {
            id: chunkId,
            job_id: jobId,
            job_root_url: `nostr:${resolvedPubkeyHex}`,
            job_label: `NOSTR · ${relayUrls[0] ?? "relay"}`,
            job_kind: "nostr",
            page_url: eventUrl,
            page_label: label,
            chunk_index: chunk.chunk_index,
            text: chunk.text,
            bias: "neutral",
            indexed_at: Date.now(),
          },
          vec,
        );
        chunks_indexed++;
      }

      onProgress?.(label, i + 1, events_fetched);
    }
  } finally {
    pool.close(relayUrls);
  }

  return { events_fetched, chunks_indexed, skipped };
}

/** Check whether a NIP-07 extension is present in this browser. */
export function hasNip07(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { nostr?: unknown }).nostr
  );
}
