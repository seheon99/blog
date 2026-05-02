import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { tagColor } from "@/lib/tag-colors";
import { formatPostDate } from "@/lib/format-date";
import type { GraphLink, GraphNode } from "@/lib/post-graph";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

function nodeMatchesTag(n: GraphNode, tag: string | null): boolean {
  if (!tag) return true;
  return n.tags.includes(tag);
}

type SimNode = GraphNode & SimulationNodeDatum;

type SimLink = SimulationLinkDatum<SimNode>;

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  activeTag?: string | null;
}

const NODE_RADIUS_BASE = 12;
const NODE_RADIUS_PER_MINUTE = 2.5;
const LABEL_GAP = 14;

function radiusFor(readMinutes: number): number {
  return NODE_RADIUS_BASE + readMinutes * NODE_RADIUS_PER_MINUTE;
}

function makeFakeLinks(nodes: GraphNode[], count: number): GraphLink[] {
  if (nodes.length < 2) return [];
  const seen = new Set<string>();
  const out: GraphLink[] = [];
  let attempts = 0;
  const maxAttempts = count * 20;
  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    const b = nodes[Math.floor(Math.random() * nodes.length)];
    if (a.id === b.id) continue;
    const [s, t] = [a.id, b.id].sort();
    const key = `${s}|${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source: s, target: t });
  }
  return out;
}

export default function PostGraph({
  nodes: rawNodes,
  links: propLinks,
  activeTag = null,
}: Props) {
  const nodeIncluded = useMemo(() => {
    const set = new Set<string>();
    for (const n of rawNodes) if (nodeMatchesTag(n, activeTag)) set.add(n.id);
    return set;
  }, [rawNodes, activeTag]);
  const fakeCount = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const n = parseInt(
      new URLSearchParams(window.location.search).get("fake") ?? "0",
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, []);
  const rawLinks = useMemo(
    () =>
      fakeCount > 0
        ? makeFakeLinks(rawNodes, Math.min(fakeCount, rawNodes.length * 3))
        : propLinks,
    [propLinks, rawNodes, fakeCount],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const drag = useRef<{ id: string | null; moved: boolean; pointerId: number | null }>({
    id: null,
    moved: false,
    pointerId: null,
  });
  const panDrag = useRef<
    | {
        startClientX: number;
        startClientY: number;
        originX: number;
        originY: number;
        pointerId: number;
        moved: boolean;
      }
    | null
  >(null);
  const animRef = useRef<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const hoveredIdRef = useRef<string | null>(null);
  hoveredIdRef.current = hoveredId;
  const pinnedIdRef = useRef<string | null>(null);
  pinnedIdRef.current = pinnedId;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardTargetId = pinnedId ?? hoveredId;
  const cardTargetIdRef = useRef<string | null>(null);
  cardTargetIdRef.current = cardTargetId;

  function updateCardPosition() {
    const id = cardTargetIdRef.current;
    const card = cardRef.current;
    if (!id || !card) return;
    const node = simNodesRef.current.find((n) => n.id === id);
    if (!node || node.x == null || node.y == null) return;
    const r = radiusFor(node.readMinutes);
    const x = node.x + panRef.current.x + r + 14;
    const y = node.y + panRef.current.y - 16;
    card.style.transform = `translate(${x}px, ${y}px)`;
  }

  useEffect(() => {
    updateCardPosition();
  }, [cardTargetId, pan.x, pan.y]);

  function cancelPanAnim() {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }

  function animatePanTo(targetX: number, targetY: number, duration = 350) {
    cancelPanAnim();
    if (reducedMotion) {
      setPan({ x: targetX, y: targetY });
      return;
    }
    const start = performance.now();
    const from = { ...panRef.current };
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = ease(t);
      setPan({
        x: from.x + (targetX - from.x) * e,
        y: from.y + (targetY - from.y) * e,
      });
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  }

  function centerOnNode(id: string) {
    const node = simNodesRef.current.find((n) => n.id === id);
    if (!node || node.x == null || node.y == null) return;
    animatePanTo(size.width / 2 - node.x, size.height / 2 - node.y);
  }

  useEffect(() => () => cancelPanAnim(), []);

  const pinnedNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (!pinnedId) return set;
    for (const link of rawLinks) {
      if (link.source === pinnedId) set.add(link.target);
      else if (link.target === pinnedId) set.add(link.source);
    }
    return set;
  }, [pinnedId, rawLinks]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        setSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const nodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const links: SimLink[] = rawLinks.map((l) => ({ ...l }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;

    const tick = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const lineEls = svg.querySelectorAll<SVGLineElement>("line[data-link]");
      lineEls.forEach((el, i) => {
        const link = links[i];
        const s = link.source as SimNode;
        const t = link.target as SimNode;
        el.setAttribute("x1", String(s.x ?? 0));
        el.setAttribute("y1", String(s.y ?? 0));
        el.setAttribute("x2", String(t.x ?? 0));
        el.setAttribute("y2", String(t.y ?? 0));
      });
      const groupEls = svg.querySelectorAll<SVGGElement>("g[data-node]");
      groupEls.forEach((el, i) => {
        const n = nodes[i];
        el.setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
      });
      updateCardPosition();
    };

    if (rawLinks.length === 0) {
      const cx = size.width / 2;
      const cy = size.height / 2;
      const r = Math.max(60, Math.min(cx, cy) - 80);
      const total = Math.max(nodes.length, 1);
      nodes.forEach((n, i) => {
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        n.x = cx + r * Math.cos(angle);
        n.y = cy + r * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });
      tick();
      return;
    }

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80)
          .strength(0.6),
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("x", forceX(size.width / 2).strength(0.05))
      .force("y", forceY(size.height / 2).strength(0.05))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radiusFor(d.readMinutes) + 6),
      );

    sim.on("tick", tick);
    simRef.current = sim;

    return () => {
      sim.stop();
      sim.on("tick", null);
      simRef.current = null;
    };
  }, [rawNodes, rawLinks, size.width, size.height]);

  function clientToSvg(x: number, y: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function onPointerDown(e: React.PointerEvent<SVGGElement>, id: string) {
    cancelPanAnim();
    setHoveredId(null);
    drag.current = { id, moved: false, pointerId: e.pointerId };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    const d = drag.current;
    if (!d.id || d.pointerId !== e.pointerId) return;
    if (!d.moved) {
      d.moved = true;
      simRef.current?.alphaTarget(0.3).restart();
    }
    const node = simNodesRef.current.find((n) => n.id === d.id);
    if (!node) return;
    const local = clientToSvg(e.clientX, e.clientY);
    if (!local) return;
    node.fx = local.x - panRef.current.x;
    node.fy = local.y - panRef.current.y;
  }

  function onBgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    cancelPanAnim();
    setHoveredId(null);
    setPinnedId(null);
    panDrag.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
      pointerId: e.pointerId,
      moved: false,
    };
    setIsPanning(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onBgPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const d = panDrag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) d.moved = true;
    setPan({ x: d.originX + dx, y: d.originY + dy });
  }

  function onBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    const d = panDrag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // Plain click on empty background (no drag) → ease camera home.
    if (!d.moved) {
      animatePanTo(0, 0);
    }
    panDrag.current = null;
    setIsPanning(false);
  }

  function onPointerUp(e: React.PointerEvent<SVGGElement>) {
    const d = drag.current;
    if (!d.id || d.pointerId !== e.pointerId) return;
    if (d.moved) {
      const node = simNodesRef.current.find((n) => n.id === d.id);
      if (node && rawLinks.length > 0) {
        node.fx = null;
        node.fy = null;
      }
      simRef.current?.alphaTarget(0);
    }
    d.id = null;
    d.pointerId = null;
  }

  function onNodeClick(e: React.MouseEvent<SVGGElement>, id: string) {
    if (drag.current.moved) {
      e.preventDefault();
      drag.current.moved = false;
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    // Second click on the same already-pinned node → navigate (handoff §click flow).
    if (pinnedIdRef.current === id) {
      const node = rawNodes.find((n) => n.id === id);
      if (node) {
        e.preventDefault();
        window.location.href = node.href;
      }
      return;
    }
    e.preventDefault();
    setPinnedId(id);
    setHoveredId(null);
    centerOnNode(id);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      aria-label="post graph"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`${rawNodes.length} posts, ${rawLinks.length} links`}
      >
        <defs>
          <pattern
            id="post-graph-grid"
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={12}
              cy={12}
              r={1.2}
              fill="var(--fg-3)"
              fillOpacity={0.25}
            />
          </pattern>
        </defs>
        <rect
          width={size.width}
          height={size.height}
          fill="transparent"
          onPointerDown={onBgPointerDown}
          onPointerMove={onBgPointerMove}
          onPointerUp={onBgPointerUp}
          onPointerCancel={onBgPointerUp}
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
        />
        <g transform={`translate(${pan.x} ${pan.y})`}>
          <rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="url(#post-graph-grid)"
            pointerEvents="none"
            aria-hidden="true"
          />
          <g aria-hidden="true">
            {rawLinks.map((link, i) => {
              const touchesPinned =
                !!pinnedId &&
                (link.source === pinnedId || link.target === pinnedId);
              const tagFiltered =
                !!activeTag &&
                (!nodeIncluded.has(link.source) ||
                  !nodeIncluded.has(link.target));
              return (
                <line
                  key={`${link.source}->${link.target}-${i}`}
                  data-link
                  stroke={touchesPinned ? "var(--brand-500)" : "var(--border)"}
                  strokeOpacity={
                    tagFiltered ? 0 : !pinnedId || touchesPinned ? 0.85 : 0.15
                  }
                  strokeWidth={touchesPinned ? 2.5 : 1.75}
                  style={{
                    transition:
                      "stroke 200ms, stroke-opacity 200ms, stroke-width 200ms",
                  }}
                />
              );
            })}
          </g>
          {rawNodes.map((n) => {
            const r = radiusFor(n.readMinutes);
            const isPinned = pinnedId === n.id;
            return (
              <g
                key={n.id}
                data-node
                data-id={n.id}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerEnter={() => {
                  if (pinnedIdRef.current) return;
                  if (drag.current.id || panDrag.current) return;
                  setHoveredId(n.id);
                }}
                onPointerLeave={() => {
                  if (pinnedIdRef.current) return;
                  if (hoveredIdRef.current === n.id) setHoveredId(null);
                }}
                onClick={(e) => onNodeClick(e, n.id)}
                style={{
                  cursor: "grab",
                  opacity:
                    activeTag && !nodeIncluded.has(n.id)
                      ? 0.32
                      : pinnedId &&
                          pinnedId !== n.id &&
                          !pinnedNeighbors.has(n.id)
                        ? 0.25
                        : 1,
                  transition: "opacity 200ms",
                }}
              >
                {isPinned && !reducedMotion && (
                  <circle
                    r={r}
                    fill="none"
                    stroke="var(--brand-500)"
                    strokeWidth={2}
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      from={r}
                      to={r * 2.4}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from={0.6}
                      to={0}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <a href={n.href} aria-label={n.title}>
                  <circle
                    r={r}
                    fill={tagColor(n.primaryTag)}
                    stroke="var(--bg-1)"
                    strokeWidth={1.5}
                  />
                  <text
                    y={r + LABEL_GAP}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--fg-1)"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.title}
                  </text>
                </a>
              </g>
            );
          })}
        </g>
      </svg>
      {rawLinks.length === 0 && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-fg-3">
          no links yet — add{" "}
          <code className="rounded bg-bg-2 px-1 font-mono">[[wikilinks]]</code>{" "}
          between posts to connect them
        </p>
      )}
      {cardTargetId && (
        <PreviewCard
          ref={cardRef}
          node={rawNodes.find((n) => n.id === cardTargetId)!}
          pinned={pinnedId === cardTargetId}
          onClose={() => setPinnedId(null)}
        />
      )}
    </div>
  );
}

const PreviewCard = forwardRef<
  HTMLDivElement,
  { node: GraphNode; pinned: boolean; onClose: () => void }
>(function PreviewCard({ node, pinned, onClose }, ref) {
  const date = formatPostDate(node.createdAt);
  return (
    <div
      ref={ref}
      className={`absolute top-0 left-0 hidden w-72 rounded-lg border bg-bg-1 p-4 shadow-lg md:block ${
        pinned
          ? "cursor-pointer border-fg-1 shadow-xl"
          : "pointer-events-none border-border"
      }`}
      style={{ willChange: "transform" }}
      role={pinned ? undefined : "tooltip"}
      onClick={
        pinned
          ? () => {
              window.location.href = node.href;
            }
          : undefined
      }
    >
      {pinned && (
        <button
          type="button"
          aria-label="dismiss preview"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-2 right-2 grid h-5.5 w-5.5 place-items-center rounded-full text-fg-3 transition-colors hover:bg-bg-3 hover:text-fg-1"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
      )}
      <div className="mb-2 flex items-center gap-2 pr-6 font-mono text-[10px] uppercase tracking-[0.04em] text-fg-3">
        {date && <time dateTime={node.createdAt}>{date}</time>}
        {date && <span aria-hidden="true">·</span>}
        <span>{node.readMinutes} min</span>
        {node.primaryTag && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-brand-600">{node.primaryTag}</span>
          </>
        )}
      </div>
      <p className="text-[15px] font-semibold leading-tight text-fg-1">
        {node.title}
      </p>
      {node.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-snug text-fg-2">
          {node.description}
        </p>
      )}
      {pinned && (
        <a
          href={node.href}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 -mx-1 block border-t border-dashed border-border px-1 pt-3 font-mono text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          open article →
        </a>
      )}
    </div>
  );
});
