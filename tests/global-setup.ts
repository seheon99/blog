import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures/posts");
const POSTS_DIR = path.join(REPO_ROOT, "src/content/posts");
// `astro sync --mode test` lands data-store.json in cacheDir
// (node_modules/.astro). The container API spun up by Vitest reads from
// dotAstroDir (.astro). Copy the produced store across so getCollection()
// resolves under both layouts.
const SYNC_OUTPUT = path.join(REPO_ROOT, "node_modules/.astro/data-store.json");
const RUNTIME_STORE = path.join(REPO_ROOT, ".astro/data-store.json");

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

// `src/content/posts` is a private submodule. When it isn't checked out
// (CI without submodules, fresh clones, contributors without vault access),
// the directory is empty and content-collection-driven tests have nothing
// to render. Seed fixture markdown into that path for the test run only.
export default function setup() {
  const seeded: string[] = [];
  let copiedStore = false;
  let hadRuntimeStore = false;
  let previousRuntimeStore: Buffer | null = null;

  if (listMarkdown(POSTS_DIR).length === 0) {
    for (const file of listMarkdown(FIXTURES_DIR)) {
      const dest = path.join(POSTS_DIR, file);
      copyFileSync(path.join(FIXTURES_DIR, file), dest);
      seeded.push(dest);
    }
  }

  if (listMarkdown(POSTS_DIR).length > 0) {
    execFileSync("npx", ["astro", "sync"], { cwd: REPO_ROOT, stdio: "inherit" });
    if (existsSync(SYNC_OUTPUT)) {
      hadRuntimeStore = existsSync(RUNTIME_STORE);
      previousRuntimeStore = hadRuntimeStore ? readFileSync(RUNTIME_STORE) : null;
      mkdirSync(path.dirname(RUNTIME_STORE), { recursive: true });
      copyFileSync(SYNC_OUTPUT, RUNTIME_STORE);
      copiedStore = true;
    }
  }

  return () => {
    for (const file of seeded) {
      try {
        unlinkSync(file);
      } catch {
        // ignore cleanup errors
      }
    }
    if (copiedStore) {
      try {
        if (hadRuntimeStore && previousRuntimeStore) {
          writeFileSync(RUNTIME_STORE, previousRuntimeStore);
        } else {
          unlinkSync(RUNTIME_STORE);
        }
      } catch {
        // ignore cleanup errors
      }
    }
  };
}
