import { parseWikilinks } from "./wikilinks";
import { readMinutes } from "./read-time";

export interface GraphNode {
  id: string;
  href: string;
  title: string;
  description: string;
  createdAt: string;
  tags: string[];
  primaryTag?: string;
  readMinutes: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface PostGraphInput {
  id: string;
  body?: string | null;
  data: {
    title?: string;
    description?: string;
    createdAt?: Date;
    tags?: string[];
  };
}

export interface PostGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ResolvedRef {
  fromId: string;
  toId: string;
}

function toNode(post: PostGraphInput): GraphNode {
  return {
    id: post.id,
    href: `/posts/${post.id}`,
    title: post.data.title ?? post.id,
    description: post.data.description ?? "",
    createdAt: post.data.createdAt?.toISOString() ?? "",
    tags: post.data.tags ?? [],
    primaryTag: post.data.tags?.[0],
    readMinutes: readMinutes(post.body ?? ""),
  };
}

function buildLookups(nodes: GraphNode[]): {
  idSet: Set<string>;
  titleMap: Map<string, string[]>;
} {
  const idSet = new Set(nodes.map((n) => n.id));
  const titleMap = new Map<string, string[]>();
  for (const node of nodes) {
    const key = node.title.toLowerCase().trim();
    if (!key) continue;
    const list = titleMap.get(key);
    if (list) list.push(node.id);
    else titleMap.set(key, [node.id]);
  }
  return { idSet, titleMap };
}

function* iterateRefs(
  posts: PostGraphInput[],
  idSet: Set<string>,
  titleMap: Map<string, string[]>,
  options: { warnUnresolved: boolean },
): Generator<ResolvedRef> {
  for (const post of posts) {
    const body = post.body ?? "";
    if (!body) continue;
    for (const ref of parseWikilinks(body)) {
      const resolved = resolveTarget(ref.target, idSet, titleMap);
      if (!resolved) {
        if (options.warnUnresolved) {
          console.warn(
            `[buildPostGraph] unresolved wikilink in ${post.id}: [[${ref.target}]]`,
          );
        }
        continue;
      }
      yield { fromId: post.id, toId: resolved };
    }
  }
}

export function buildPostGraph(posts: PostGraphInput[]): PostGraph {
  const nodes = posts.map(toNode);
  const { idSet, titleMap } = buildLookups(nodes);

  const seen = new Set<string>();
  const links: GraphLink[] = [];

  for (const { fromId, toId } of iterateRefs(posts, idSet, titleMap, {
    warnUnresolved: true,
  })) {
    if (fromId === toId) continue;
    const [a, b] = [fromId, toId].sort();
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: a, target: b });
  }

  return { nodes, links };
}

export function getBacklinks(
  posts: PostGraphInput[],
  targetId: string,
): GraphNode[] {
  const nodes = posts.map(toNode);
  const { idSet, titleMap } = buildLookups(nodes);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const seen = new Set<string>();
  const result: GraphNode[] = [];
  for (const { fromId, toId } of iterateRefs(posts, idSet, titleMap, {
    warnUnresolved: false,
  })) {
    if (toId !== targetId) continue;
    if (fromId === targetId) continue;
    if (seen.has(fromId)) continue;
    seen.add(fromId);
    const node = nodesById.get(fromId);
    if (node) result.push(node);
  }
  return result;
}

function resolveTarget(
  target: string,
  idSet: Set<string>,
  titleMap: Map<string, string[]>,
): string | null {
  const normalized = target.replace(/\.md$/i, "").replace(/^\/+/, "");
  if (idSet.has(normalized)) return normalized;

  const candidates = titleMap.get(target.toLowerCase().trim());
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const sorted = [...candidates].sort();
  console.warn(
    `[buildPostGraph] ambiguous title "${target}" matches ${candidates.length} posts: ${sorted.join(", ")}; using ${sorted[0]}.`,
  );
  return sorted[0];
}
