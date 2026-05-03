import fs from "node:fs";
import path from "node:path";

import type { Link, Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";
import { visit, SKIP } from "unist-util-visit";

const POSTS_ROOT = path.resolve("src/content/posts");

// Plain wikilink: [[target]] / [[target|alias]] / [[target#heading]] /
// [[target#heading|alias]]. The leading `(?<!!)` excludes Obsidian image
// embeds (`![[image.svg]]`), which `remark-obsidian-embed.ts` handles
// separately.
const WIKILINK_RE = /(?<!!)\[\[([^\]\n]+)\]\]/g;

interface PostsIndex {
  idSet: Set<string>;
  titleMap: Map<string, string[]>;
}

let cachedIndex: PostsIndex | null = null;

function readFrontmatterTitle(filePath: string): string | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
  if (!content.startsWith("---")) return undefined;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return undefined;
  const fm = content.slice(3, end);
  const match = fm.match(/^title:\s*["']?(.*?)["']?\s*$/m);
  return match?.[1];
}

function walkPosts(
  dir: string,
  baseDir: string,
  out: { id: string; title?: string }[],
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Mirror the content-collection glob: skip names starting with `_`
    // (e.g. `_resources/`, `_drafts/`).
    if (entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPosts(full, baseDir, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const id = path
        .relative(baseDir, full)
        .replace(/\.md$/i, "")
        .replace(/\\/g, "/");
      out.push({ id, title: readFrontmatterTitle(full) });
    }
  }
}

function buildIndex(): PostsIndex {
  const posts: { id: string; title?: string }[] = [];
  walkPosts(POSTS_ROOT, POSTS_ROOT, posts);
  const idSet = new Set(posts.map((p) => p.id));
  const titleMap = new Map<string, string[]>();
  for (const post of posts) {
    if (!post.title) continue;
    const key = post.title.toLowerCase().trim();
    if (!key) continue;
    const list = titleMap.get(key);
    if (list) list.push(post.id);
    else titleMap.set(key, [post.id]);
  }
  return { idSet, titleMap };
}

function getIndex(): PostsIndex {
  if (cachedIndex == null) cachedIndex = buildIndex();
  return cachedIndex;
}

export function _resetWikilinkIndexCache(): void {
  cachedIndex = null;
}

function resolveTarget(target: string): string | null {
  const { idSet, titleMap } = getIndex();
  const normalized = target.replace(/\.md$/i, "").replace(/^\/+/, "");
  if (idSet.has(normalized)) return normalized;
  const candidates = titleMap.get(target.toLowerCase().trim());
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return [...candidates].sort()[0];
}

// Mirrors GitHub's heading-anchor slug rules well enough for ASCII-heading
// fragments (`[[post#Some Heading]]`). Drop most punctuation, lowercase,
// collapse whitespace runs to a single hyphen.
function slugifyHeading(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ -⁯⸀-⹿'!"#$%&()*+,./:;<=>?@\[\]\\^`{|}~]/g, "")
    .replace(/\s+/g, "-");
}

interface ParsedRef {
  target: string;
  heading?: string;
  alias?: string;
}

function parseInner(inner: string): ParsedRef | null {
  const trimmed = inner.trim();
  if (!trimmed) return null;

  const [linkPart, ...aliasParts] = trimmed.split("|");
  const alias = aliasParts.length > 0 ? aliasParts.join("|").trim() : undefined;

  const hashIdx = linkPart.indexOf("#");
  const target = (hashIdx === -1 ? linkPart : linkPart.slice(0, hashIdx)).trim();
  if (!target) return null;
  const heading =
    hashIdx === -1 ? undefined : linkPart.slice(hashIdx + 1).trim() || undefined;

  return {
    target,
    ...(heading ? { heading } : {}),
    ...(alias ? { alias } : {}),
  };
}

function buildLinkNode(ref: ParsedRef, resolvedId: string): Link {
  let url = `/posts/${resolvedId}`;
  if (ref.heading) url += `#${slugifyHeading(ref.heading)}`;

  const text = ref.alias ?? ref.target;
  return {
    type: "link",
    url,
    data: { hProperties: { className: ["wikilink"] } },
    children: [{ type: "text", value: text }],
  };
}

function buildReplacements(
  value: string,
  filePath: string | undefined,
): RootContent[] | null {
  const out: RootContent[] = [];
  let lastIndex = 0;
  let matched = false;
  WIKILINK_RE.lastIndex = 0;
  for (const match of value.matchAll(WIKILINK_RE)) {
    const ref = parseInner(match[1]);
    if (!ref) continue;

    const resolvedId = resolveTarget(ref.target);

    matched = true;
    const start = match.index ?? 0;
    if (start > lastIndex) {
      out.push({ type: "text", value: value.slice(lastIndex, start) });
    }
    if (resolvedId) {
      out.push(buildLinkNode(ref, resolvedId));
    } else {
      // Unresolved: leave the original `[[...]]` in the text so editors can
      // see and fix the broken link, and warn at build time.
      console.warn(
        `[remark-obsidian-wikilink] unresolved wikilink ${match[0]}${
          filePath ? ` in ${filePath}` : ""
        }`,
      );
      out.push({ type: "text", value: match[0] });
    }
    lastIndex = start + match[0].length;
  }
  if (!matched) return null;
  if (lastIndex < value.length) {
    out.push({ type: "text", value: value.slice(lastIndex) });
  }
  return out;
}

const remarkObsidianWikilink: Plugin<[], Root> = () => {
  return (tree, file) => {
    const filePath = file.path;
    visit(tree, "text", (node: Text, index, parent) => {
      if (parent == null || index == null) return;
      const value = node.value;
      // Cheap guard: skip nodes that can't possibly contain a wikilink.
      if (!value.includes("[[")) return;

      const replacements = buildReplacements(value, filePath);
      if (replacements == null) return;

      parent.children.splice(index, 1, ...replacements);
      return [SKIP, index + replacements.length];
    });
  };
};

export default remarkObsidianWikilink;
export {
  buildReplacements,
  parseInner,
  resolveTarget,
  slugifyHeading,
  WIKILINK_RE,
};
