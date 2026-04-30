export interface WikilinkRef {
  raw: string;
  target: string;
  alias?: string;
}

const FENCED_CODE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]*`/g;
const WIKILINK = /(?<!!)\[\[([^\]\n]+)\]\]/g;

export function parseWikilinks(markdown: string): WikilinkRef[] {
  if (!markdown) return [];

  const stripped = markdown.replace(FENCED_CODE, "").replace(INLINE_CODE, "");

  const refs: WikilinkRef[] = [];
  for (const match of stripped.matchAll(WIKILINK)) {
    const inner = match[1].trim();
    if (!inner) continue;

    const [linkPart, aliasPart] = inner.split("|", 2);
    const target = linkPart.split("#", 1)[0].trim();
    if (!target) continue;

    const alias = aliasPart?.trim();
    refs.push({
      raw: match[0],
      target,
      ...(alias ? { alias } : {}),
    });
  }
  return refs;
}
