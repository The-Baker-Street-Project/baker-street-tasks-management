import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks", // Process isolation — prevents PGlite singleton conflicts between test files
    passWithNoTests: true,
  },
});
