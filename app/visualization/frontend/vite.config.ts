import type { UserConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
// Vite consumes this exported configuration; Vitest extends its typed test field.
export default {
  plugins: [tailwindcss(), svelte()],
  base: "./",
  resolve: {
    conditions: ["browser"],
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    commonjsOptions: { include: [/validators\.cjs$/, /node_modules/] },
  },
  test: { environment: "jsdom", clearMocks: true },
} satisfies UserConfig;
