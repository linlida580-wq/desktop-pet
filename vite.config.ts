/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev server port and disables the host check so the
// WebView2 can reach the dev server over localhost.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    watch: {
      // Tauri's Rust sources are watched by cargo, not vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tauri uses a fixed port for the preview server during `tauri build`.
  preview: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2021",
    sourcemap: false,
    outDir: "dist",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
