/**
 * @workspace/pipes — Pipe Manifest schema, types, and validator.
 *
 * A "Pipe" is a curated, opinionated knowledge bundle consumed by the
 * Greater shell. The FOSS shell ships *no* Pipes; production
 * deployments mount Pipes locally from `data/pipes/` (gitignored).
 * Loading a Pipe transforms the relevant demo from "Generic mode" to
 * "Greater mode" — different system prompt, different curated corpus,
 * a visible badge, and (for multi-bias Pipes like Bitcoin) a bias
 * toggle in the chat UI.
 *
 * This package is the single source of truth for the manifest shape.
 * Both the build-time loader (Vite plugin) and any future authoring
 * tools depend on it.
 */
import { z } from "zod";
import schemaJson from "./manifest.schema.json" with { type: "json" };

/**
 * Bias option declared by a Pipe. The `id` matches the chunk-level
 * `bias` tag stamped by the ingestion pipeline (Task #4).
 */
export const BiasOptionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_-]*$/, "Bias id must be lowercase kebab/snake"),
  label: z.string().min(1),
  description: z.string().min(1),
});
export type BiasOption = z.infer<typeof BiasOptionSchema>;

/**
 * One corpus bundle file shipped with a Pipe. The Greater shell loads
 * it through the same code path as the Task #4 Bitcoin bundle, so
 * `path` must point at a JSON file with the
 * `{ documents: [{ source_url, source_label, bias?, chunks: [...] }] }`
 * shape.
 */
export const CorpusBundleSchema = z.object({
  path: z.string().min(1),
  chunk_count: z.number().int().nonnegative(),
  bias_distribution: z.record(z.string(), z.number().int().nonnegative()),
});
export type CorpusBundle = z.infer<typeof CorpusBundleSchema>;

/**
 * PGP signature metadata. The runtime treats every Pipe as
 * "Unsigned — local development build" until the verification path
 * is wired (post-MVP).
 */
export const PipeSignatureSchema = z.object({
  status: z.enum(["unsigned", "signed", "invalid"]),
  signed_by: z.string().nullable().optional(),
  signed_at: z.string().datetime().nullable().optional(),
});
export type PipeSignature = z.infer<typeof PipeSignatureSchema>;

/**
 * The Pipe persona must match a Greater demo route slug so the
 * runtime registry can pair Pipes with demos.
 */
export const PIPE_PERSONAS = [
  "fintech",
  "startups",
  "faith",
  "schools",
  "small-business",
  "healthtech",
] as const;
export type PipePersona = (typeof PIPE_PERSONAS)[number];

export const PipeManifestSchema = z.object({
  pipe_id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Pipe id must be lowercase kebab"),
  name: z.string().min(1),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/,
      "Version must be SemVer (e.g. 1.0.0 or 1.0.0-rc1)",
    ),
  persona: z.enum(PIPE_PERSONAS),
  bias_options: z.array(BiasOptionSchema).min(1),
  corpus_bundles: z.array(CorpusBundleSchema),
  system_prompts: z.record(z.string(), z.string()),
  signature: PipeSignatureSchema,
  created_at: z.string().datetime(),
  author_notes: z.string().optional(),
});
export type PipeManifest = z.infer<typeof PipeManifestSchema>;

/**
 * Parse and validate a Pipe manifest. Throws a ZodError on failure;
 * callers should catch and surface a useful diagnostic.
 */
export function parsePipeManifest(input: unknown): PipeManifest {
  return PipeManifestSchema.parse(input);
}

export const pipeManifestJsonSchema = schemaJson;
