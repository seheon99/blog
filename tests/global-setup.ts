import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures/posts");
const POSTS_DIR = path.join(REPO_ROOT, "src/content/posts");
const ASTRO_BIN = path.join(
  REPO_ROOT,
  "node_modules/.bin",
  process.platform === "win32" ? "astro.CMD" : "astro",
);
// `astro sync --mode test` lands data-store.json in cacheDir
// (node_modules/.astro). The container API spun up by Vitest reads from
// dotAstroDir (.astro). Copy the produced store across so getCollection()
// resolves under both layouts.
const SYNC_OUTPUT = path.join(REPO_ROOT, "node_modules/.astro/data-store.json");
const RUNTIME_STORE = path.join(REPO_ROOT, ".astro/data-store.json");

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((file) => file.endsWith(".md"));
}

function hasMarkdownFile(dir: string): boolean {
  if (!existsSync(dir)) return false;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) return true;
    if (entry.isDirectory() && hasMarkdownFile(fullPath)) return true;
  }
  return false;
}

function unlinkIfExists(filePath: string): void {
  if (!existsSync(filePath)) return;
  unlinkSync(filePath);
}

function syncAstroContent(): void {
  unlinkIfExists(SYNC_OUTPUT);
  unlinkIfExists(RUNTIME_STORE);

  try {
    if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/d", "/c", "call", ASTRO_BIN, "sync"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
      return;
    }

    execFileSync(ASTRO_BIN, ["sync"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  } catch (error) {
    const childError = error as {
      status?: number;
      stdout?: Buffer;
      stderr?: Buffer;
    };
    if (
      process.platform === "win32" &&
      childError.status === 3221226505 &&
      existsSync(SYNC_OUTPUT)
    ) {
      return;
    }
    if (childError.stdout) process.stdout.write(childError.stdout);
    if (childError.stderr) process.stderr.write(childError.stderr);
    throw error;
  }
}

// `src/content/posts` is a private submodule. When it isn't checked out
// (CI without submodules, fresh clones, contributors without vault access),
// the directory is empty and content-collection-driven tests have nothing
// to render. Seed fixture markdown into that path for the test run only.
export default function setup() {
  const seeded: string[] = [];
  let copiedStore = false;

  if (!hasMarkdownFile(POSTS_DIR)) {
    mkdirSync(POSTS_DIR, { recursive: true });
    for (const file of listMarkdownFiles(FIXTURES_DIR)) {
      const dest = path.join(POSTS_DIR, file);
      copyFileSync(path.join(FIXTURES_DIR, file), dest);
      seeded.push(dest);
    }
  }

  if (seeded.length > 0) {
    syncAstroContent();
    if (existsSync(SYNC_OUTPUT)) {
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
        unlinkIfExists(SYNC_OUTPUT);
        unlinkIfExists(RUNTIME_STORE);
      } catch {
        // ignore cleanup errors
      }
    }
  };
}
