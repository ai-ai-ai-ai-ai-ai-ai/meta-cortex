import type { ViteUserConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { GuideSource } from "./tools/guide-source.ts";
import { NativeValidators } from "./tools/native-validators.ts";
// Vite consumes this exported configuration; Vitest extends its typed test field.
export default {
  plugins: [new NativeValidators(), new GuideSource(), tailwindcss(), svelte()],
  base: "./",
  resolve: {
    conditions: ["browser"],
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "agent-guide-content", test: "virtual:agent-guide" },
            { name: "effect", test: /node_modules[\\/]effect[\\/]/ },
            { name: "native-contracts", test: "virtual:dashboard-validators" },
            {
              name: "markdown",
              test: /node_modules[\\/]markdown-it(?:-anchor)?[\\/]/,
            },
            {
              name: "diagram-drawing",
              test: /node_modules[\\/]d3(?:-[^\\/]+)?[\\/]/,
            },
            {
              name: "diagram-layout",
              test: /node_modules[\\/]dagre-d3-es[\\/]/,
            },
            {
              name: "diagram-utilities",
              test: /node_modules[\\/](?:roughjs|dayjs|dompurify|khroma|stylis|marked)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: { environment: "jsdom", clearMocks: true },
} satisfies ViteUserConfig;
