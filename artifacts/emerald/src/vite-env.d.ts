/// <reference types="vite/client" />

/**
 * Compile-time constant injected by `vite.config.ts` `define`. ISO-8601
 * timestamp of when the running bundle was built. Surfaced in the
 * build-stamp footer so a curious visitor can verify the page is real
 * (and freshly compiled), not a static template.
 */
declare const __BUILD_TIMESTAMP__: string;

declare module "*.png" {
  const src: string;
  export default src;
}
