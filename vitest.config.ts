import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    env: {
      // Keep the mongodb-memory-server binary inside the project (the
      // default user-profile cache lives on a drive that may be full).
      MONGOMS_DOWNLOAD_DIR: path.resolve(
        import.meta.dirname,
        "node_modules/.cache/mongodb-binaries",
      ),
    },
  },
});
