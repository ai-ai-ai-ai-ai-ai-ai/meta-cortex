import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({
  plugins: [svelte()],
  base: "./",
  resolve: { conditions: ["browser"] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    commonjsOptions: { include: [/validators\.cjs$/, /node_modules/] },
  },
  test: { environment: "jsdom", clearMocks: true },
});
