import type { KbChunk } from "./types";

/**
 * One chunk in the curated seed corpus. The full {@link KbChunk} job_*
 * fields are filled in by `LLMProvider.ensureSeedCorpus`, which wraps
 * the entire corpus into a single ingestion job in the Knowledge panel.
 */
export type SeedChunk = Pick<
  KbChunk,
  "id" | "page_url" | "page_label" | "chunk_index" | "text" | "bias"
>;

/**
 * Persona slug stamped on every {@link SEED_CORPUS} chunk at install
 * time. The seed is Blockstream/Bitcoin support content, so it
 * belongs to the FinTech persona only — exposing it on the Faith or
 * Schools demos was the cross-persona contamination bug Task #26
 * fixes.
 */
export const SEED_CORPUS_PERSONA = "fintech";

/**
 * Hand-curated seed corpus for the Blockstream/FinTech demo so the
 * end-to-end RAG pipeline is testable before any external ingestion
 * happens. ~20 chunks covering Bitcoin basics, hardware-wallet hygiene,
 * Blockstream products, and Lightning. Each chunk is the unit that the
 * embedder vectorizes and that the retriever returns.
 */
export const SEED_CORPUS: SeedChunk[] = [
  {
    id: "bs-jade-recovery-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/900002487766",
    page_label: "Blockstream Help — Recovering a Jade",
    chunk_index: 0,
    text: "Blockstream Jade is a hardware wallet that stores private keys offline. To recover a Jade after device loss, you initialize a replacement Jade and select 'Restore Wallet', then enter your 12- or 24-word recovery phrase using the on-device input. The recovery phrase is the only secret needed; Blockstream cannot recover the wallet for you. If a passphrase (the 25th-word feature) was used, it is also required, and it never leaves your device.",
  },
  {
    id: "bs-jade-pin-1",
    page_url: "https://help.blockstream.com/hc/en-us/categories/900000056726",
    page_label: "Blockstream Help — Jade PIN",
    chunk_index: 0,
    text: "Jade uses a server-assisted PIN system: the device unlocks the secret by combining your PIN with a per-device key held by the Blockstream Oracle, with a strict failed-attempt limit. Three wrong PINs in a row trigger a wipe. The PIN never leaves the device, and the Oracle cannot read your private keys; it only participates in the unlock challenge.",
  },
  {
    id: "bs-green-2fa-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/900001388566",
    page_label: "Blockstream Green — Two-Factor Authentication",
    chunk_index: 0,
    text: "Blockstream Green wallets support optional two-factor authentication via Google Authenticator, SMS, or email. 2FA in Green is enforced co-signing: the second factor signs spending transactions on the server side, which means losing 2FA without a backup will not lose funds, but it will require the nLockTime recovery transaction to spend.",
  },
  {
    id: "bs-green-recovery-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/900001392283",
    page_label: "Blockstream Green — Recovery",
    chunk_index: 0,
    text: "Green wallets are 2-of-2 multisig by default (you + Blockstream). Recovery is possible without Blockstream via the nLockTime emergency-recovery file you should download and store offline, or via the recovery xpub if you opted into 2-of-3. The recovery file expires the co-sign requirement after a fixed time (default 6 months), so it must be re-issued periodically.",
  },
  {
    id: "bitcoin-seed-phrase-1",
    page_url: "https://bitcoin.org/en/secure-your-wallet",
    page_label: "Bitcoin.org — Secure Your Wallet",
    chunk_index: 0,
    text: "A seed phrase (also called a recovery phrase or mnemonic) is a list of 12 or 24 English words that encode the master private key of a Bitcoin wallet. Anyone with the seed phrase can spend the funds. Store it offline, in at least two physically separate locations, on a durable medium (paper, steel, etc.), and never type it into a website, email, or chat. Legitimate support will never ask for your seed phrase.",
  },
  {
    id: "bitcoin-fees-1",
    page_url: "https://bitcoin.org/en/glossary/transaction-fees",
    page_label: "Bitcoin.org — Transaction Fees",
    chunk_index: 0,
    text: "Bitcoin transaction fees are paid per virtual byte of transaction data, not per bitcoin amount. Larger or more complex transactions (many inputs, multisig, etc.) cost more in fees than a small simple transaction. Fee rates fluctuate with mempool demand; wallets estimate a fee that gets you confirmed within a target number of blocks. You can usually adjust the fee manually if your wallet supports RBF (replace-by-fee).",
  },
  {
    id: "bitcoin-confirmations-1",
    page_url: "https://bitcoin.org/en/glossary/confirmations",
    page_label: "Bitcoin.org — Confirmations",
    chunk_index: 0,
    text: "A confirmation is a block that includes your transaction or is mined on top of one that does. One confirmation is typically enough for small payments; six confirmations is the conventional threshold for high-value irreversibility. Until a transaction is confirmed, it can in principle be replaced or invalidated, especially if the original sender used opt-in RBF.",
  },
  {
    id: "bs-liquid-1",
    page_url: "https://blockstream.com/liquid/",
    page_label: "Blockstream Liquid — Overview",
    chunk_index: 0,
    text: "Liquid is a Bitcoin sidechain by Blockstream that enables faster, confidential settlement and the issuance of digital assets pegged to bitcoin or to other currencies. Liquid blocks come every minute and use a federation of functionaries to peg bitcoin in and out. It is intended for exchanges, market-makers, and asset issuers — not as a replacement for self-custody on Bitcoin's main chain.",
  },
  {
    id: "lightning-channels-1",
    page_url: "https://lightning.network/lightning-network-paper.pdf",
    page_label: "Lightning Network — Whitepaper",
    chunk_index: 0,
    text: "The Lightning Network is a layer-2 protocol that uses payment channels — multisig outputs on Bitcoin that two parties update off-chain — to settle many small payments without putting each one on the base chain. Funds in a channel are not on-chain until the channel is closed. Routing across channels lets you pay anyone reachable through the network without opening a direct channel to them.",
  },
  {
    id: "phishing-support-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/9000018",
    page_label: "Blockstream — Avoiding Phishing",
    chunk_index: 0,
    text: "Common attacks against Bitcoin users impersonate official support over Telegram, Discord, X (Twitter), or email. Real Blockstream support will never DM you first, never ask for your seed phrase or PIN, and never request remote-control software (AnyDesk, TeamViewer) on your machine. If a 'support agent' contacts you and demands urgency, treat it as fraud and report it.",
  },
  {
    id: "wallet-types-1",
    page_url: "https://bitcoin.org/en/choose-your-wallet",
    page_label: "Bitcoin.org — Choose Your Wallet",
    chunk_index: 0,
    text: "Bitcoin wallets come in three main shapes: hardware wallets (private keys never leave a dedicated device — best for long-term holdings), software wallets running on your phone or computer (convenient, lower assurance), and custodial wallets where a third party holds your keys (like an exchange — easiest, but you do not own the bitcoin until you withdraw it on-chain).",
  },
  {
    id: "address-reuse-1",
    page_url: "https://en.bitcoin.it/wiki/Address_reuse",
    page_label: "Bitcoin Wiki — Address Reuse",
    chunk_index: 0,
    text: "Reusing the same Bitcoin address damages your privacy because every payment to that address is publicly visible to anyone who knows it. Modern wallets generate a fresh receive address for every payment from an HD seed; you do not lose access to funds sent to old addresses, you simply stop using them for new payments. The privacy cost of address reuse compounds over time.",
  },
  {
    id: "bs-jade-firmware-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/900001486763",
    page_label: "Blockstream Help — Updating Jade Firmware",
    chunk_index: 0,
    text: "Jade firmware updates ship through the Jade companion app or Blockstream Green; the device verifies the firmware signature on-device before installing. Always confirm the version number on Jade's screen matches the release notes; never install firmware sent to you by a stranger or downloaded from a third-party mirror. A bad firmware install cannot extract your seed if you keep it offline-only.",
  },
  {
    id: "psbt-1",
    page_url: "https://bitcoinops.org/en/topics/psbt/",
    page_label: "Bitcoin Optech — PSBT",
    chunk_index: 0,
    text: "A Partially Signed Bitcoin Transaction (PSBT, BIP 174) is a portable file format for transactions that need signatures from multiple devices or parties. Multisig wallets, hardware wallets, and air-gapped setups exchange PSBTs to coordinate signing without exposing private keys. Most modern Bitcoin wallets, including Jade and Green, support PSBT.",
  },
  {
    id: "core-vs-knots-1",
    page_url: "https://bitcoinknots.org/",
    page_label: "Bitcoin Knots — About",
    chunk_index: 0,
    text: "Bitcoin Core is the reference implementation maintained at github.com/bitcoin/bitcoin. Bitcoin Knots is a derivative project maintained by Luke Dashjr that periodically merges Core releases plus additional patches and stricter mempool policy. The two implementations are consensus-compatible — both produce and validate the same chain — but their relay and mempool defaults differ.",
  },
  {
    id: "fee-bumping-rbf-1",
    page_url: "https://bitcoinops.org/en/topics/replace-by-fee/",
    page_label: "Bitcoin Optech — Replace-By-Fee",
    chunk_index: 0,
    text: "If a transaction was sent with too low a fee and is stuck unconfirmed, opt-in RBF lets the sender broadcast a replacement transaction with a higher fee, which miners are economically motivated to mine instead. RBF only works if the original was flagged as replaceable. CPFP (child-pays-for-parent) is the alternative when RBF is not available — a recipient bumps the parent by spending its output in a high-fee child transaction.",
  },
  {
    id: "cold-storage-1",
    page_url: "https://en.bitcoin.it/wiki/Cold_storage",
    page_label: "Bitcoin Wiki — Cold Storage",
    chunk_index: 0,
    text: "Cold storage means keeping the private keys offline, on a device that has never connected to the internet. The two practical implementations are a hardware wallet kept disconnected except when signing, and a fully air-gapped computer that signs PSBTs transferred via QR or microSD. Cold storage drastically reduces the attack surface for theft and malware compared to a hot wallet.",
  },
  {
    id: "self-custody-1",
    page_url: "https://blockstream.com/2020/01/27/en-self-custody-best-practices/",
    page_label: "Blockstream Blog — Self-Custody Best Practices",
    chunk_index: 0,
    text: "Self-custody means you, and only you, control the keys to your bitcoin. The trade-off is responsibility: lose the keys, lose the bitcoin. Best practice is a hardware wallet for the bulk of holdings, a software wallet for spending money, geographically separated backups of your seed phrase, and a documented inheritance plan. Custodial services trade self-sovereignty for convenience and counterparty risk.",
  },
  {
    id: "broadcast-stuck-1",
    page_url: "https://help.blockstream.com/hc/en-us/articles/900001388886",
    page_label: "Blockstream Help — Stuck Transactions",
    chunk_index: 0,
    text: "If your Bitcoin transaction has been unconfirmed for many hours, the most likely cause is that the fee rate is below what miners are currently mining. Options: wait for mempool to clear, use RBF in your wallet to bump the fee, or use CPFP from the recipient side. If the transaction was not flagged replaceable, RBF is unavailable and you must wait or rely on CPFP.",
  },
  {
    id: "support-channels-1",
    page_url: "https://help.blockstream.com/",
    page_label: "Blockstream Help — Contact",
    chunk_index: 0,
    text: "Official Blockstream support is reached via the help center at help.blockstream.com (open a ticket). Blockstream support never initiates contact via Telegram, Discord, X DMs, or random emails. If your issue involves possible compromise — unexpected outgoing transactions, missing balances, or a stranger contacting you about your wallet — open a support ticket immediately and stop using the affected device.",
  },
];
