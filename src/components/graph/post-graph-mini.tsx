import { useEffect, useMemo, useRef, useState } from "react";
import { tagColor } from "@/lib/tag-colors";
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

interface InputNode {
  id: string;
  href: string;
  title: string;
  readMinutes: number;
  primaryTag?: string;
}

interface InputLink {
  source: string;
  target: string;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  href: string;
  title: string;
  readMinutes: number;
  primaryTag?: string;
}

type SimLink = SimulationLinkDatum<SimNode>;

interface Props {
  nodes: InputNode[];
  links: InputLink[];
  activeId: string;
}

const MIN_R = 4;
const MAX_R = 9;

function radiusFor(readMinutes: number): number {
  const t = Math.min(1, readMinutes / 12);
  return MIN_R + (MAX_R - MIN_R) * t;
}

export default function PostGraphMini({
  nodes: rawNodes,
  links: rawLinks,
  activeId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: 280, height: 220 });
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  const neighbors = useMemo(() => {
    const set = new Set<string>();
    for (const link of rawLinks) {
      if (link.source === activeId) set.add(link.target);
      else if (link.target === activeId) set.add(link.source);
    }
    return set;
  }, [rawLinks, activeId]);

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
    };

    if (rawLinks.length === 0) {
      const cx = size.width / 2;
      const cy = size.height / 2;
      const r = Math.max(40, Math.min(cx, cy) - 24);
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
          .distance(40)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-80))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("x", forceX(size.width / 2).strength(0.08))
      .force("y", forceY(size.height / 2).strength(0.08))
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
  }, [rawNodes, rawLinks, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="relative h-[220px] w-full overflow-hidden rounded-[10px] border border-border bg-bg-2"
      aria-label="post neighborhood graph"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="h-full w-full"
        role="img"
        aria-label={`${rawNodes.length} posts, ${rawLinks.length} links`}
      >
        <g aria-hidden="true">
          {rawLinks.map((link, i) => {
            const touchesActive =
              link.source === activeId || link.target === activeId;
            return (
              <line
                key={`${link.source}->${link.target}-${i}`}
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
          return (
            <g
              key={n.id}
              data-node
              data-id={n.id}
              style={{
                cursor: "pointer",
                opacity: dim ? 0.32 : 1,
                transition: "opacity 200ms",
              }}
            >
              <a href={n.href} aria-label={n.title}>
                <circle
                  r={isActive ? r + 1.5 : r}
                  fill={tagColor(n.primaryTag)}
                  stroke={isActive ? "var(--brand-500)" : "var(--bg-2)"}
                  strokeWidth={isActive ? 2 : 1}
                />
              </a>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
