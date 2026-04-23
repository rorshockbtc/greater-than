# Local Harness — Best Practices

The **Local Harness** is Greater's "manual transmission" for operators who
want to shape bot behaviour without commissioning a full curated Pipe. You
write a plain-text charter in the gear-menu → **Local Harness** panel; Greater
injects it at the very top of the system prompt on every chat turn — before
the persona identity, before the bias hint, and before any retrieved knowledge
snippets.

Think of it as the outer frame the model reasons inside. Everything else the
system knows arrives inside that frame.

---

## What goes in a harness

A harness is most useful when it contains three types of content:

### 1. Identity block

Tell the model whose brand it speaks for, in one or two sentences. Without
this, Greater falls back to its Blockstream / Bitcoin defaults and the bot
will identify itself incorrectly.

```
[Identity]: You are the support assistant for Acme Corp, a B2B SaaS
platform for logistics teams. Speak in a professional but approachable
tone.
```

### 2. Rule block

Hard constraints the model must never break, stated as imperatives. Keep
these short — each rule should fit on one line. The model is more likely to
honour rules it can skim quickly than rules buried in prose.

```
[Rule 1]: IMPORTANT — prefer retrieval-led answers. If the knowledge
snippets do not cover a question, say so and direct the visitor to the
contact form.

[Rule 2]: Never compare Acme to competitors by name.

[Rule 3]: Never discuss pricing unless a retrieved snippet confirms a
specific number.
```

### 3. Knowledge index (compressed)

A pipe-delimited table of facts the model should always have available,
even before retrieval fires. This is not a replacement for the RAG
knowledge base — it is a high-density orientation map for concepts that
come up in almost every conversation.

```
[Index]:
| /pricing        | Pro $99/mo, Team $299/mo, Enterprise custom
| /trial          | 14-day free trial, no credit card required
| /security       | SOC 2 Type II, AES-256 at rest, TLS 1.3 in transit
| /integrations   | Zapier, Slack, Salesforce, HubSpot out of the box
| /support        | Email support@acme.com or use the chat escalation
| /onboarding     | Dedicated CSM for Enterprise; self-serve docs for others
```

The pipe-delimited format fits roughly **3–4× more facts per character**
than equivalent prose. This matters because the harness budget is shared
with the persona identity, the bias hint, and the retrieved chunks.

---

## Size budget

The harness field is capped at **8 192 characters** (≈ 8 KB) in the UI.

In practice, aim for well under 4 KB so the model still has room for
the knowledge snippets that carry most of the factual weight. A harness
that crowds out retrieval defeats the purpose.

Budget breakdown (rough targets):

| Section      | Characters |
|--------------|------------|
| Identity     | < 200      |
| Rules        | < 500      |
| Index table  | < 2 000    |
| **Total**    | **< 3 000** |

---

## What NOT to put in the harness

- **Long prose documents** — put those in the knowledge base instead.
- **Conversation scripts** — the model ignores scripted exchanges.
- **Secrets or API keys** — the harness is stored in `localStorage` in the
  visitor's browser; treat it as fully public.
- **Duplicate persona instructions** — if a Pipe is mounted, its system
  prompt already carries the identity. The harness is for FOSS / no-Pipe
  deployments; mixing both creates conflicts.

---

## Persona-scoping

The harness is stored per persona slug:

```
localStorage key: greater:harness:<personaSlug>
```

Each bot in Greater (startups, bitcoin, faith, …) carries its own
independent harness. Editing the harness for the Bitcoin bot does not
affect the Startups bot.

---

## Relationship to curated Pipes

The harness is the **operator-maintained, FOSS alternative** to a curated
Pipe. A Pipe ships with:

- A structured manifest validated at build time.
- Bias options with per-bias prompt overrides.
- A curated knowledge base purpose-built for the domain.
- A versioned manifest so prompts can be updated without a site rebuild.

The harness gives you the system-prompt injection without any of the
infrastructure. It is an intentional stepping stone: most operators who
maintain a harness for more than a few weeks eventually hit the ceiling
of what plain text can express cleanly. That ceiling is the natural moment
to ask about a Pipe — see [hire.colonhyphenbracket.pink](https://hire.colonhyphenbracket.pink).

---

## Debugging

If the bot's behaviour does not match your harness:

1. **Check injection order** — the harness fires before everything else.
   If the persona system prompt conflicts with the harness, the persona
   prompt wins on overlap because it arrives second. Restate the rule
   explicitly in the harness if needed.
2. **Check size** — open the gear panel and look at the character counter.
   If you are over 4 KB, trim the index table.
3. **Check persona slug** — the harness is persona-scoped. Confirm you are
   editing the harness for the right bot (check the URL slug).
4. **Hard-refresh** — the harness is read from `localStorage` on mount.
   If you edited it outside the panel (e.g. via browser DevTools), refresh
   the page to pick up the new value.

---

*File: `HARNESS_BEST_PRACTICES.md` — maintained alongside the harness
feature in `artifacts/greater/src/components/HarnessPanel.tsx`.*
