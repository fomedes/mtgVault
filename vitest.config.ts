import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    // .ts tests run in Node; .tsx component tests run in happy-dom.
    // Vitest 4 uses `projects` (formerly `workspace`).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["__tests__/**/*.test.ts"],
          env: {
            MONGOMS_DOWNLOAD_DIR: path.resolve(
              import.meta.dirname,
              "node_modules/.cache/mongodb-binaries",
            ),
          },
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "happy-dom",
          include: ["__tests__/**/*.test.tsx"],
          setupFiles: ["__tests__/setup-dom.ts"],
        },
      },
    ],
  },
});
