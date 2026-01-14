import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kebabCase } from "es-toolkit";

import type { Loader } from "astro/loaders";

const markdownExtensions = new Set([".md", ".mdx"]);
const defaultMetaPath = "src/content/posts.meta.json";

type PostsMetaEntry = {
  updatedAt?: string;
  [key: string]: unknown;
};

type PostsMetaMap = Record<string, PostsMetaEntry>;

async function collectMarkdownFiles(
  dir: string,
  ignoreDirs: Set<string>
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue;
      }

      const childFiles = await collectMarkdownFiles(fullPath, ignoreDirs);
      files.push(...childFiles);
      continue;
    }

    if (entry.isFile() && markdownExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, "").trim();

function parseInlineArray(value: string) {
  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

function parseFrontmatter(block: string) {
  const data: Record<string, boolean | number | string | string[] | null> = {};
  const lines = block.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || !line.trim()) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2];

    if (value === "") {
      const items: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const listMatch = lines[cursor].match(/^\s+-\s+(.+)$/);
        if (!listMatch) {
          break;
        }
        items.push(stripQuotes(listMatch[1]));
        cursor += 1;
      }

      if (items.length > 0) {
        data[key] = items;
        index = cursor - 1;
        continue;
      }

      data[key] = "";
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = parseInlineArray(value);
      continue;
    }

    data[key] = stripQuotes(value);
  }

  return data;
}

const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;

function extractFrontmatter(raw: string): {
  data: { [key: string]: boolean | number | string | string[] | null };
  body: string;
} {
  const match = raw.match(frontmatterRegex);
  if (!match) {
    return { data: {}, body: raw };
  }

  const frontmatter = parseFrontmatter(match[1]);
  const body = raw.slice(match[0].length);
  return { data: frontmatter, body };
}

const toPosixPath = (value: string) => value.split(path.sep).join("/");

const stripExtension = (value: string) => value.replace(/\.(md|mdx)$/i, "");

const kebabPath = (value: string) =>
  value
    .split("/")
    .map((segment) => kebabCase(segment))
    .join("/");

type PostsMetaLoaderOptions = {
  baseDir: string;
  ignoreDirs?: string[];
  metaPath?: string;
};

async function readPostsMeta(metaPath: string): Promise<PostsMetaMap> {
  try {
    const raw = await readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as PostsMetaMap;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid posts metadata format.");
    }
    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(
        `Missing posts metadata file at ${metaPath}. Run "python3 scripts/generate-posts-meta.py".`
      );
    }
    if (error instanceof Error) {
      throw new Error(
        `Failed to read posts metadata file at ${metaPath}. ${error.message}`
      );
    }
    throw error;
  }
}

export function postsMetaLoader(options: PostsMetaLoaderOptions): Loader {
  return {
    name: "posts-meta-loader",
    load: async ({
      store,
      config,
      parseData,
      renderMarkdown,
      generateDigest,
      logger,
    }) => {
      const rootPath = fileURLToPath(config.root);
      const basePath = path.resolve(rootPath, options.baseDir);
      const ignoreDirs = new Set(options.ignoreDirs ?? []);
      const metaPath = path.resolve(rootPath, options.metaPath ?? defaultMetaPath);
      const metaMap = await readPostsMeta(metaPath);
      const files = await collectMarkdownFiles(basePath, ignoreDirs);

      store.clear();

      for (const filePath of files) {
        const raw = await readFile(filePath, "utf8");
        const { data: frontmatter, body } = extractFrontmatter(raw);
        const rendered = await renderMarkdown(body);
        const relativeToRoot = toPosixPath(path.relative(rootPath, filePath));
        const relativeToBase = toPosixPath(path.relative(basePath, filePath));
        const id = kebabPath(stripExtension(relativeToBase));
        const metaEntry = metaMap[relativeToBase];
        const updatedAt =
          typeof metaEntry?.updatedAt === "string" ? metaEntry.updatedAt : "";

        if (!updatedAt) {
          throw new Error(
            `Missing updatedAt for ${relativeToBase} in ${metaPath}. Run "python3 scripts/generate-posts-meta.py".`
          );
        }

        const data = await parseData({
          id,
          data: {
            ...frontmatter,
            updatedAt,
          },
        });

        store.set({
          id,
          data,
          rendered,
          filePath: relativeToRoot,
          digest: generateDigest(raw),
        });
      }

      logger.info(`Loaded ${files.length} post(s)`);
    },
  };
}
