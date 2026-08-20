import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias, so test files can import the same way
// application code does. No React/DOM environment configured — the modules under test
// (lib/analysis, lib/strategy, lib/orchestrator, lib/finara-ai) are plain server-side TypeScript,
// no need for jsdom.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
