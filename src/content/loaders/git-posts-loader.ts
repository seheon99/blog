import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kebabCase } from "es-toolkit";

import type { Loader } from "astro/loaders";

const markdownExtensions = new Set([".md", ".mdx"]);

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

const parseInlineArray = (value: string) => {
  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
};

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

async function getGitUpdatedAt(rootPath: string, relativePath: string) {
  try {
    const stdout = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relativePath],
      { cwd: rootPath }
    );
    return stdout.toString().trim();
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      status?: number | null;
      stderr?: Buffer | string;
    };
    const stderr =
      typeof err.stderr === "string" ? err.stderr : err.stderr?.toString();
    throw new Error(
      `Failed to collect Git metadata for ${relativePath}. ${
        stderr ?? ""
      }`.trim()
    );
  }
}

const toPosixPath = (value: string) => value.split(path.sep).join("/");

const stripExtension = (value: string) => value.replace(/\.(md|mdx)$/i, "");

const kebabPath = (value: string) =>
  value
    .split("/")
    .map((segment) => kebabCase(segment))
    .join("/");

type GitPostsLoaderOptions = {
  baseDir: string;
  ignoreDirs?: string[];
};

export function gitPostsLoader(options: GitPostsLoaderOptions): Loader {
  return {
    name: "git-posts-loader",
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
      const files = await collectMarkdownFiles(basePath, ignoreDirs);

      store.clear();

      for (const filePath of files) {
        const raw = await readFile(filePath, "utf8");
        const { data: frontmatter, body } = extractFrontmatter(raw);
        const rendered = await renderMarkdown(body);
        const relativeToBase = toPosixPath(path.relative(basePath, filePath));
        const id = kebabPath(stripExtension(relativeToBase));
        const updatedAt = await getGitUpdatedAt(basePath, relativeToBase);
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
          filePath: relativeToBase,
          digest: generateDigest(raw),
        });
      }

      logger.info(`Loaded ${files.length} post(s)`);
    },
  };
}
