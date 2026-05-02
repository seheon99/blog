import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { tagColor } from "@/lib/tag-colors";
import { runTick } from "@/lib/post-graph-tick";
import { formatPostDate } from "@/lib/format-date";
import type { GraphLink, GraphNode } from "@/lib/post-graph";
import {
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

type SimNode = SimulationNodeDatum & { id: string; readMinutes: number };

type SimLink = SimulationLinkDatum<SimNode> & { key: string };

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  activeId: string;
}

const MIN_R = 4;
const MAX_R = 9;

function radiusFor(readMinutes: number): number {
  const t = Math.min(1, readMinutes / 12);
  return MIN_R + (MAX_R - MIN_R) * t;
}

function placeNodesCircular(nodes: SimNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(40, Math.min(cx, cy) - 24);
  const total = Math.max(nodes.length, 1);
  nodes.forEach((n, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    n.x = cx + r * Math.cos(angle);
    n.y = cy + r * Math.sin(angle);
    n.fx = n.x;
    n.fy = n.y;
  });
}

export default function PostGraphMini({
  nodes: rawNodes,
  links: rawLinks,
  activeId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: 280, height: 220 });
  const simNodesByIdRef = useRef<Map<string, SimNode>>(new Map());
  const simLinksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const lastAppliedSizeRef = useRef<{ w: number; h: number } | null>(null);
  const lineRefsByKey = useRef<Map<string, SVGLineElement>>(new Map());
  const nodeRefsByKey = useRef<Map<string, SVGGElement>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardTargetId = pinnedId ?? hoveredId;
  // Bridges cardTargetId into the sim tick closure, which is captured outside
  // of render. Assigned in an effect (not in render body) so concurrent /
  // discarded renders never desync the ref from committed state.
  const cardTargetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  function updateCardPosition() {
    const id = cardTargetIdRef.current;
    const card = cardRef.current;
    if (!id || !card) return;
    const node = simNodesByIdRef.current.get(id);
    if (!node || node.x == null || node.y == null) return;
    const r = radiusFor(node.readMinutes);
    // The mini graph is narrow; default to anchoring left of the node so the
    // card stays inside the rail when there's room. If the node is in the
    // left half of the SVG, flip to the right side.
    const cardWidth = 240;
    const placeRight = node.x < size.width / 2;
    const x = placeRight
      ? node.x + r + 10
      : node.x - r - 10 - cardWidth;
    const y = Math.max(0, node.y - 28);
    card.style.transform = `translate(${x}px, ${y}px)`;
  }

  useEffect(() => {
    cardTargetIdRef.current = cardTargetId;
    updateCardPosition();
  }, [cardTargetId]);

  function onNodeClick(e: React.MouseEvent<SVGGElement>, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return; // browser default: open in new tab via the inner <a href>.
    }
    e.preventDefault();
    if (pinnedId === id) {
      const node = rawNodesById.get(id);
      if (node) window.location.href = node.href;
      return;
    }
    setPinnedId(id);
    setHoveredId(null);
  }

  function onBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    // Only clear pin when the gesture started AND ended on the bg rect itself.
    // Without this guard, a pointerup bubbling from a node would race the
    // node's onClick — clearing pinnedId before the click handler reads it,
    // making "click pinned node to navigate" silently break depending on
    // React's batching.
    if (e.target !== e.currentTarget) return;
    setPinnedId(null);
  }

  const neighbors = useMemo(() => {
    const set = new Set<string>();
    for (const link of rawLinks) {
      if (link.source === activeId) set.add(link.target);
      else if (link.target === activeId) set.add(link.source);
    }
    return set;
  }, [rawLinks, activeId]);

  const rawNodesById = useMemo(
    () => new Map(rawNodes.map((n) => [n.id, n])),
    [rawNodes],
  );

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
    const nodes: SimNode[] = rawNodes.map((n) => ({
      id: n.id,
      readMinutes: n.readMinutes,
    }));
    const links: SimLink[] = rawLinks.map((l, i) => ({
      ...l,
      key: `${l.source}->${l.target}-${i}`,
    }));
    simNodesByIdRef.current = new Map(nodes.map((n) => [n.id, n]));
    simLinksRef.current = links;
    lastAppliedSizeRef.current = { w: size.width, h: size.height };

    const tick = () =>
      runTick({
        lineEls: lineRefsByKey.current,
        nodeEls: nodeRefsByKey.current,
        nodes,
        links,
        onAfterTick: updateCardPosition,
      });

    if (rawLinks.length === 0) {
      placeNodesCircular(nodes, size.width, size.height);
      tick();
      return;
    }

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(40)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-80))
      .force("x", forceX<SimNode>(size.width / 2).strength(0.08))
      .force("y", forceY<SimNode>(size.height / 2).strength(0.08))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radiusFor(d.readMinutes) + 3),
      );

    sim.on("tick", tick);
    simRef.current = sim;

    return () => {
      sim.stop();
      sim.on("tick", null);
      simRef.current = null;
    };
    // size intentionally omitted — resize is handled in the effect below by
    // updating forces in place rather than rebuilding the simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawLinks]);

  useEffect(() => {
    const last = lastAppliedSizeRef.current;
    if (last && last.w === size.width && last.h === size.height) return;
    lastAppliedSizeRef.current = { w: size.width, h: size.height };

    const sim = simRef.current;
    if (sim) {
      sim
        .force("x", forceX<SimNode>(size.width / 2).strength(0.08))
        .force("y", forceY<SimNode>(size.height / 2).strength(0.08));
      sim.alpha(0.3).restart();
      return;
    }
    // No active sim → empty-links fallback. Re-pin nodes and re-tick.
    const nodes = Array.from(simNodesByIdRef.current.values());
    if (nodes.length === 0) return;
    placeNodesCircular(nodes, size.width, size.height);
    runTick({
      lineEls: lineRefsByKey.current,
      nodeEls: nodeRefsByKey.current,
      nodes,
      links: simLinksRef.current,
      onAfterTick: updateCardPosition,
    });
  }, [size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="relative h-[220px] w-full rounded-[10px] border border-border bg-bg-2"
      aria-label="post neighborhood graph"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="h-full w-full"
        role="img"
        aria-label={`${rawNodes.length} posts, ${rawLinks.length} links`}
      >
        <rect
          width={size.width}
          height={size.height}
          fill="transparent"
          onPointerUp={onBgPointerUp}
        />
        <g aria-hidden="true">
          {rawLinks.map((link, i) => {
            const touchesActive =
              link.source === activeId || link.target === activeId;
            const linkKey = `${link.source}->${link.target}-${i}`;
            return (
              <line
                key={linkKey}
                ref={(el) => {
                  if (el) lineRefsByKey.current.set(linkKey, el);
                  else lineRefsByKey.current.delete(linkKey);
                }}
                data-link
                stroke={
                  touchesActive ? "var(--brand-500)" : "var(--border)"
                }
                strokeOpacity={touchesActive ? 0.85 : 0.4}
                strokeWidth={touchesActive ? 1.5 : 1}
              />
            );
          })}
        </g>
        {rawNodes.map((n) => {
          const r = radiusFor(n.readMinutes);
          const isActive = n.id === activeId;
          const isNeighbor = neighbors.has(n.id);
          const dim = !isActive && !isNeighbor;
          const isPinned = pinnedId === n.id;
          return (
            <g
              key={n.id}
              ref={(el) => {
                if (el) nodeRefsByKey.current.set(n.id, el);
                else nodeRefsByKey.current.delete(n.id);
              }}
              data-node
              data-id={n.id}
              onPointerEnter={() => {
                if (pinnedId) return;
                setHoveredId(n.id);
              }}
              onPointerLeave={() => {
                if (pinnedId) return;
                if (hoveredId === n.id) setHoveredId(null);
              }}
              onClick={(e) => onNodeClick(e, n.id)}
              style={{
                cursor: "pointer",
                opacity: dim ? 0.32 : 1,
                transition: "opacity 200ms",
              }}
            >
              <a
                href={n.href}
                aria-label={n.title}
                className="post-graph-mini-node"
              >
                <circle
                  r={isActive || isPinned ? r + 1.5 : r}
                  fill={tagColor(n.primaryTag)}
                  stroke={
                    isPinned
                      ? "var(--fg-1)"
                      : isActive
                        ? "var(--brand-500)"
                        : "var(--bg-2)"
                  }
                  strokeWidth={isPinned || isActive ? 2 : 1}
                />
              </a>
              {isPinned && !reducedMotion && (
                <circle
                  r={r + 2}
                  fill="none"
                  stroke="var(--brand-500)"
                  strokeWidth={2}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    from={r + 2}
                    to={r * 2.6 + 4}
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from={0.85}
                    to={0}
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      {(() => {
        if (!cardTargetId) return null;
        const node = rawNodesById.get(cardTargetId);
        if (!node) return null;
        return (
          <MiniPreviewCard
            ref={cardRef}
            node={node}
            pinned={pinnedId === cardTargetId}
            onClose={() => setPinnedId(null)}
          />
        );
      })()}
    </div>
  );
}

const MiniPreviewCard = forwardRef<
  HTMLDivElement,
  { node: GraphNode; pinned: boolean; onClose: () => void }
>(function MiniPreviewCard({ node, pinned, onClose }, ref) {
  const date = formatPostDate(node.createdAt);
  return (
    <div
      ref={ref}
      className={`absolute top-0 left-0 z-10 w-60 rounded-md border bg-bg-1 p-3 ${
        pinned
          ? "cursor-pointer border-fg-1 shadow-xl"
          : "pointer-events-none border-border shadow-lg"
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
          className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full text-fg-3 transition-colors hover:bg-bg-3 hover:text-fg-1"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
      )}
      <div className="mb-1.5 flex items-center gap-1.5 pr-5 font-mono text-[9px] uppercase tracking-[0.04em] text-fg-3">
        {date && <time dateTime={node.createdAt}>{date}</time>}
        {date && <span aria-hidden="true">·</span>}
        <span>{node.readMinutes} min</span>
        {node.primaryTag && (
          <>
            <span aria-hidden="true">·</span>
            <span style={{ color: tagColor(node.primaryTag) }}>
              #{node.primaryTag}
            </span>
          </>
        )}
      </div>
      <p className="text-[13px] font-semibold leading-tight text-fg-1">
        {node.title}
      </p>
      {node.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-fg-2">
          {node.description}
        </p>
      )}
      {pinned && (
        <a
          href={node.href}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 -mx-1 block border-t border-dashed border-border px-1 pt-2 font-mono text-[11px] font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          open article →
        </a>
      )}
    </div>
  );
});
