import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { AstroConfig, AstroIntegrationLogger } from "astro";
import type { DataStore, LoaderContext, MetaStore } from "astro/loaders";

import { postsMetaLoader } from "../src/content/loaders/posts-meta-loader";

const createLogger = (): AstroIntegrationLogger => ({
  options: {
    dest: { write: () => true },
    level: "silent",
  },
  label: "test",
  fork: () => createLogger(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe("postsMetaLoader", () => {
  it("loads posts using metadata frontmatter and updatedAt", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "posts-meta-loader-"));
    const postsDir = path.join(rootDir, "src", "content", "posts");
    await mkdir(path.join(postsDir, "nested"), { recursive: true });
    await mkdir(path.join(postsDir, "_templates"), { recursive: true });

    const firstRaw = `---\ntitle: Hello World\ndescription: Testing\n---\n# Hello\n`;
    const secondRaw = `---\ntitle: Second Post\n---\nContent\n`;
    await writeFile(path.join(postsDir, "Hello World.md"), firstRaw);
    await writeFile(path.join(postsDir, "nested", "Second.md"), secondRaw);
    await writeFile(path.join(postsDir, "_templates", "Ignored.md"), firstRaw);

    const metaEntries = {
      "Hello World.md": {
        updatedAt: "2024-01-01T00:00:00Z",
        frontmatter: { title: "Hello World", description: "Testing" },
      },
      "nested/Second.md": {
        updatedAt: "2024-02-02T00:00:00Z",
        frontmatter: { title: "Second Post" },
      },
    };
    await writeFile(
      path.join(rootDir, "src", "content", "posts.meta.json"),
      `${JSON.stringify(metaEntries, null, 2)}\n`
    );

    type StoreItem = {
      id: string;
      data: Record<string, unknown>;
      filePath?: string;
      rendered?: { html: string };
      digest?: string | number;
    };
    const storeItems: StoreItem[] = [];

    const loader = postsMetaLoader({
      baseDir: "src/content/posts",
      ignoreDirs: ["_templates"],
    });

    const renderMarkdownSpy = vi.fn(async (body: string) => ({ html: body }));
    const parseData: LoaderContext["parseData"] = async ({ data }) => data;
    const generateDigest: LoaderContext["generateDigest"] = (data) => {
      const raw = typeof data === "string" ? data : JSON.stringify(data);
      return `digest-${raw.length}`;
    };
    const logger = createLogger();
    const config = {
      root: pathToFileURL(`${rootDir}${path.sep}`),
      integrations: [],
    } as AstroConfig;
    const store: DataStore = {
      get: ((key: string) => storeItems.find((item) => item.id === key)) as DataStore["get"],
      entries: (() => storeItems.map((item) => [item.id, item])) as DataStore["entries"],
      set: ((item: StoreItem) => {
        storeItems.push(item);
        return true;
      }) as DataStore["set"],
      values: (() => [...storeItems]) as DataStore["values"],
      keys: (() => storeItems.map((item) => item.id)) as DataStore["keys"],
      delete: ((key: string) => {
        const index = storeItems.findIndex((item) => item.id === key);
        if (index >= 0) {
          storeItems.splice(index, 1);
        }
      }) as DataStore["delete"],
      clear: (() => {
        storeItems.length = 0;
      }) as DataStore["clear"],
      has: ((key: string) => storeItems.some((item) => item.id === key)) as DataStore["has"],
      addModuleImport: (() => undefined) as DataStore["addModuleImport"],
    };
    const metaCache = new Map<string, string>();
    const meta: MetaStore = {
      get: ((key: string) => metaCache.get(key)) as MetaStore["get"],
      set: ((key: string, value: string) => {
        metaCache.set(key, value);
      }) as MetaStore["set"],
      has: ((key: string) => metaCache.has(key)) as MetaStore["has"],
      delete: ((key: string) => {
        metaCache.delete(key);
      }) as MetaStore["delete"],
    };

    const context: LoaderContext = {
      collection: "posts",
      store,
      meta,
      logger,
      config,
      parseData,
      renderMarkdown: renderMarkdownSpy,
      generateDigest,
    };

    await loader.load(context);

    expect(storeItems).toHaveLength(2);

    const byId = new Map(storeItems.map((item) => [item.id, item]));
    expect(byId.get("hello-world")?.data.updatedAt).toBe(
      metaEntries["Hello World.md"].updatedAt
    );
    expect(byId.get("hello-world")?.data.title).toBe("Hello World");
    expect(byId.get("nested/second")?.data.title).toBe("Second Post");
    expect(byId.get("hello-world")?.filePath).toBe(
      "src/content/posts/Hello World.md"
    );

    for (const call of renderMarkdownSpy.mock.calls) {
      expect(call[0].startsWith("---")).toBe(false);
    }
    expect(renderMarkdownSpy.mock.calls[0][0]).toContain("# Hello");
    expect(logger.info).toHaveBeenCalledWith("Loaded 2 post(s)");
  });
});
