# Greater Harness Charters

A harness charter is the persistent orientation document that sits at the top of a bot's system prompt. It defines who the bot is, what rules it follows, and provides a compressed knowledge index so the model can answer questions even before retrieval completes.

## Structure

Each charter has three named sections:

**[Identity]** — Who the bot is, what it knows, and what it's running on. Tone and style live here. Keep this to 3-5 sentences.

**[Rules]** — Hard constraints written as testable imperatives. The first rule must always be the retrieval directive. Every rule should be falsifiable: "cite sources" is testable, "be thoughtful" is not. Aim for 5-8 rules.

**[Index]** — A pipe-delimited knowledge map covering the key topics in the bot's domain. Format: `Topic | Description | Sources`. The index lets the model orient itself before RAG retrieval runs. Keep each entry to one line.

## Budget

The full charter must fit within **6,000 characters** to leave room in the 8KB harness slot for bias hints, session context, and any operator overrides added via the Harness Panel. Run `wc -m docs/harness/<persona>/charter.md` before committing.

## How it wires in

The charter text is used as the default value for the Harness Panel when no custom harness has been saved to localStorage. The user can edit or replace it via the Harness Panel in the chat widget — any saved version takes precedence.

The key `greater:harness:<persona>` in localStorage holds any operator-saved overrides. If that key is absent, the charter file is used verbatim.

## Adding a bias-specific variant

Do not put bias-specific tone into the base charter. Bias hints belong in the Pipe system prompt (`data/pipes/<persona>/pipe.json`). The charter covers the neutral, common-ground voice; the Pipe adds the perspective layer on top.

## Personas

| Persona | Charter | Status |
|---------|---------|--------|
| Bitcoin / FinTech | `bitcoin/charter.md` | ✅ Done |
| Faith | — | Pending |
| Startups | — | Pending |
| Schools | — | Pending |
| Small Business | — | Pending |
| HealthTech | — | Pending |
| Greater meta-bot | — | Pending |
