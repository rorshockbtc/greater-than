import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { pipesLoader } from "./vite-plugins/pipes-loader";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

// Greater Pipes are gitignored and live at the repo root.
const pipesDir = path.resolve(import.meta.dirname, "../../data/pipes");

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), pipesLoader({ pipesDir })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "../../attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  define: {
    // Surfaced in the build-stamp footer so a curious visitor can
    // see when the bundle they're running was actually compiled.
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
