/// <reference types="vitest" />
import path from "node:path";

import { getViteConfig } from "astro/config";

export default getViteConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // @ts-expect-error — vitest extends Vite's UserConfig at runtime, but
  // astro's getViteConfig type doesn't surface the test field.
  test: {
    fileParallelism: false,
  },
});
