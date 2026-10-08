import type { UserConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { GuideSource } from "./tools/guide-source";
import { NativeValidators } from "./tools/native-validators";
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
    rollupOptions: {
      output: {
        manualChunks: {
          effect: ["effect"],
          "native-contracts": ["virtual:dashboard-validators"],
          "agent-guide-content": ["virtual:agent-guide"],
          markdown: ["markdown-it", "markdown-it-anchor"],
          "diagram-drawing": ["d3"],
          "diagram-layout": ["dagre-d3-es"],
          "diagram-utilities": [
            "roughjs",
            "dayjs",
            "dompurify",
            "khroma",
            "stylis",
            "marked",
          ],
        },
      },
    },
  },
  test: { environment: "jsdom", clearMocks: true },
} satisfies UserConfig;
