import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Image, Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";
import { visit, SKIP } from "unist-util-visit";

const POSTS_ROOT = path.resolve("src/content/posts");
const RESOURCES_DIRNAME = "_resources";

// Obsidian image embed: ![[file.ext]] / ![[file.ext|alt]] / ![[file.ext|WIDTH]]
// / ![[file.ext|WIDTHxHEIGHT]] / ![[file.ext|alt|WIDTHxHEIGHT]]. The pipe
// segments after the filename are interpreted as size when they look like
// `\d+` or `\d+x\d+`, otherwise as alt text. This matches Obsidian's behavior
// described in https://obsidian.md/help/embeds.
const EMBED_RE = /!\[\[([^\]\n|]+)((?:\|[^\]\n|]*)*)\]\]/g;
const SIZE_RE = /^(\d+)(?:x(\d+))?$/;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

interface EmbedSpec {
  alt: string;
  width?: number;
  height?: number;
}

function parseSpec(filename: string, suffix: string): EmbedSpec {
  const segments = suffix
    .split("|")
    .slice(1) // leading empty segment from the split on "|first|second"
    .map((s) => s.trim())
    .filter(Boolean);

  let alt = filename;
  let width: number | undefined;
  let height: number | undefined;

  for (const seg of segments) {
    const sizeMatch = seg.match(SIZE_RE);
    if (sizeMatch) {
      width = Number(sizeMatch[1]);
      height = sizeMatch[2] ? Number(sizeMatch[2]) : undefined;
    } else {
      alt = seg;
    }
  }
  return { alt, width, height };
}

function toRelativeUrl(fromDir: string, filename: string): string {
  const target = path.join(POSTS_ROOT, RESOURCES_DIRNAME, filename);
  let rel = path.relative(fromDir, target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function buildImageNode(url: string, spec: EmbedSpec): Image {
  const node: Image = { type: "image", url, alt: spec.alt };
  const props: Record<string, number> = {};
  if (spec.width != null) props.width = spec.width;
  if (spec.height != null) props.height = spec.height;
  if (Object.keys(props).length > 0) {
    node.data = { hProperties: props };
  }
  return node;
}

function resolveFileDir(file: { path?: string; history?: string[] }): string | null {
  const filePath = file.path ?? file.history?.[file.history.length - 1];
  if (!filePath) return null;
  const resolved = filePath.startsWith("file://")
    ? fileURLToPath(filePath)
    : path.resolve(filePath);
  return path.dirname(resolved);
}

const remarkObsidianEmbed: Plugin<[], Root> = () => {
  return (tree, file) => {
    const fileDir = resolveFileDir(file);
    if (!fileDir) return;

    visit(tree, "text", (node: Text, index, parent) => {
      if (parent == null || index == null) return;
      const value = node.value;
      if (!value.includes("![[")) return;

      const replacements = buildReplacements(value, fileDir);
      if (replacements == null) return;

      parent.children.splice(index, 1, ...replacements);
      return [SKIP, index + replacements.length];
    });
  };
};

function buildReplacements(
  value: string,
  fileDir: string,
): RootContent[] | null {
  const out: RootContent[] = [];
  let lastIndex = 0;
  let matched = false;
  EMBED_RE.lastIndex = 0;
  for (const match of value.matchAll(EMBED_RE)) {
    const filename = match[1].trim();
    if (!IMAGE_EXT_RE.test(filename)) continue; // leave non-image embeds alone

    matched = true;
    const start = match.index ?? 0;
    if (start > lastIndex) {
      out.push({ type: "text", value: value.slice(lastIndex, start) });
    }
    const spec = parseSpec(filename, match[2] ?? "");
    const url = toRelativeUrl(fileDir, filename);
    out.push(buildImageNode(url, spec));
    lastIndex = start + match[0].length;
  }
  if (!matched) return null;
  if (lastIndex < value.length) {
    out.push({ type: "text", value: value.slice(lastIndex) });
  }
  return out;
}

export default remarkObsidianEmbed;
export { buildReplacements, parseSpec, toRelativeUrl };
