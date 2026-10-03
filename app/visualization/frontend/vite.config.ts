import type { UserConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { NativeValidators } from "./tools/native-validators";
// Vite consumes this exported configuration; Vitest extends its typed test field.
export default {
  plugins: [new NativeValidators(), tailwindcss(), svelte()],
  base: "./",
  resolve: {
    conditions: ["browser"],
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: { effect: ["effect"] } } },
  },
  test: { environment: "jsdom", clearMocks: true },
} satisfies UserConfig;
