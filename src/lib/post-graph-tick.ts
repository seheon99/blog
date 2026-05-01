export type TickNode = { id: string; x?: number; y?: number };
export type TickLink = {
  key: string;
  source: TickNode | string | number;
  target: TickNode | string | number;
};

export function runTick(params: {
  lineEls: ReadonlyMap<string, SVGLineElement>;
  nodeEls: ReadonlyMap<string, SVGGElement>;
  nodes: TickNode[];
  links: TickLink[];
  onAfterTick: () => void;
}): void {
  const { lineEls, nodeEls, nodes, links, onAfterTick } = params;
  const linkCount = links.length;
  for (let i = 0; i < linkCount; i++) {
    const link = links[i];
    const el = lineEls.get(link.key);
    if (!el) continue;
    const s = link.source as TickNode;
    const t = link.target as TickNode;
    el.setAttribute("x1", String(s.x ?? 0));
    el.setAttribute("y1", String(s.y ?? 0));
    el.setAttribute("x2", String(t.x ?? 0));
    el.setAttribute("y2", String(t.y ?? 0));
  }
  const nodeCount = nodes.length;
  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    const el = nodeEls.get(node.id);
    if (!el) continue;
    el.setAttribute("transform", `translate(${node.x ?? 0},${node.y ?? 0})`);
  }
  onAfterTick();
}
