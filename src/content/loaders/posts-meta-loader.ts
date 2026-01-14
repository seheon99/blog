import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { kebabCase } from "es-toolkit";

import type { Loader } from "astro/loaders";

const markdownExtensions = new Set([".md", ".mdx"]);
const defaultMetaPath = "src/content/posts.meta.json";

type PostsMetaEntry = {
  updatedAt?: string;
  frontmatter?: Record<string, unknown>;
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

const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;

const stripFrontmatter = (raw: string) => raw.replace(frontmatterRegex, "");

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
      const metaPath = path.resolve(
        rootPath,
        options.metaPath ?? defaultMetaPath
      );
      const metaMap = await readPostsMeta(metaPath);
      const files = await collectMarkdownFiles(basePath, ignoreDirs);

      store.clear();

      for (const filePath of files) {
        const raw = await readFile(filePath, "utf8");
        const body = stripFrontmatter(raw);
        const rendered = await renderMarkdown(body);
        const relativeToRoot = toPosixPath(path.relative(rootPath, filePath));
        const relativeToBase = toPosixPath(path.relative(basePath, filePath));
        const id = kebabPath(stripExtension(relativeToBase));
        const metaEntry = metaMap[relativeToBase];
        const updatedAt = metaEntry?.updatedAt ?? "";
        const frontmatter = metaEntry?.frontmatter ?? {};

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

        logger.debug(`Loaded post: ${filePath}`);
      }

      logger.info(`Loaded ${files.length} post(s)`);
    },
  };
}
