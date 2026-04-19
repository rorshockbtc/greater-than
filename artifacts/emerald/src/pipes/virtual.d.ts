/**
 * Ambient declaration for the virtual module exposed by the
 * `greater-pipes-loader` Vite plugin. The plugin synthesizes a
 * module that re-exports any `*.manifest.json` files present in
 * `<repo>/data/pipes/` (gitignored) at build time.
 */
declare module "virtual:greater-pipes" {
  import type { PipeManifest } from "@workspace/pipes";
  export const PIPES: PipeManifest[];
}
