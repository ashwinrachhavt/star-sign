import { defineConfig } from "vitest/config";

export default defineConfig({
  // Both suites share one disposable Postgres; serialize file execution.
  test: {
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
