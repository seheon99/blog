import path from "node:path";

import { getViteConfig } from "astro/config";

export default getViteConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    fileParallelism: false,
  },
});
