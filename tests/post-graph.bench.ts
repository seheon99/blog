// @vitest-environment happy-dom
import { bench, describe } from "vitest";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import { runTick, type TickLink, type TickNode } from "../src/lib/post-graph-tick";

const SVG_NS = "http://www.w3.org/2000/svg";

function buildFixture(N: number): {
  svg: SVGSVGElement;
  nodes: TickNode[];
  links: TickLink[];
  lineEls: Map<string, SVGLineElement>;
  nodeEls: Map<string, SVGGElement>;
  cleanup: () => void;
} {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  document.body.appendChild(svg);
  const nodes: TickNode[] = [];
  const nodeEls = new Map<string, SVGGElement>();
  const lineEls = new Map<string, SVGLineElement>();
  for (let i = 0; i < N; i++) {
    nodes.push({
      id: `n${i}`,
      x: Math.random() * 280,
      y: Math.random() * 220,
    });
  }
  const links: TickLink[] = [];
  for (let i = 0; i < N; i++) {
    const source = nodes[i];
    const target = nodes[(i + 1) % N];
    const key = `${source.id}->${target.id}-${i}`;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("data-link", "");
    line.setAttribute("data-link-id", key);
    svg.appendChild(line);
    lineEls.set(key, line);
    links.push({ key, source, target });
  }
  for (const node of nodes) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("data-node", "");
    g.setAttribute("data-id", node.id);
    svg.appendChild(g);
    nodeEls.set(node.id, g);
  }
  return { svg, nodes, links, lineEls, nodeEls, cleanup: () => svg.remove() };
}

const noop = () => {};

describe("runTick — querySelectorAll vs ref-Map (review §1 + §3)", () => {
  for (const N of [6, 50, 200, 500]) {
    const fixture = buildFixture(N);
    bench(`querySelectorAll — N=${N}`, () => {
      const ls = fixture.svg.querySelectorAll<SVGLineElement>("line[data-link]");
      ls.forEach((el, i) => {
        const link = fixture.links[i];
        const s = link.source as TickNode;
        const t = link.target as TickNode;
        el.setAttribute("x1", String(s.x ?? 0));
        el.setAttribute("y1", String(s.y ?? 0));
        el.setAttribute("x2", String(t.x ?? 0));
        el.setAttribute("y2", String(t.y ?? 0));
      });
      const gs = fixture.svg.querySelectorAll<SVGGElement>("g[data-node]");
      gs.forEach((el, i) => {
        const n = fixture.nodes[i];
        el.setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
      });
    });
    bench(`ref-Map       — N=${N}`, () => {
      runTick({
        lineEls: fixture.lineEls,
        nodeEls: fixture.nodeEls,
        nodes: fixture.nodes,
        links: fixture.links,
        onAfterTick: noop,
      });
    });
  }
});

describe("find vs Map.get — review §2 lookup", () => {
  for (const N of [50, 200, 500]) {
    const items = Array.from({ length: N }, (_, i) => ({ id: `n${i}`, x: i, y: i }));
    const map = new Map(items.map((it) => [it.id, it]));
    const targetId = `n${Math.floor(N / 2)}`;
    bench(`Array.find — N=${N}`, () => {
      items.find((n) => n.id === targetId);
    });
    bench(`Map.get   — N=${N}`, () => {
      map.get(targetId);
    });
  }
});

describe("sim resize: rebuild vs in-place force update (review §5)", () => {
  type ResizeNode = SimulationNodeDatum & { id: string; readMinutes: number };
  type ResizeLink = SimulationLinkDatum<ResizeNode>;
  const buildSeed = (N: number) => {
    const nodes: ResizeNode[] = Array.from({ length: N }, (_, i) => ({
      id: `n${i}`,
      readMinutes: 5,
    }));
    const links: ResizeLink[] = Array.from({ length: N }, (_, i) => ({
      source: nodes[i],
      target: nodes[(i + 1) % N],
    }));
    return { nodes, links };
  };
  const buildFreshSim = (seed: { nodes: ResizeNode[]; links: ResizeLink[] }) =>
    forceSimulation(seed.nodes.map((n) => ({ ...n })))
      .force(
        "link",
        forceLink<ResizeNode, ResizeLink>(seed.links.map((l) => ({ ...l })))
          .id((d) => d.id)
          .distance(40)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-80))
      .force("center", forceCenter(140, 110))
      .force("x", forceX<ResizeNode>(140).strength(0.08))
      .force("y", forceY<ResizeNode>(110).strength(0.08))
      .force(
        "collide",
        forceCollide<ResizeNode>().radius(7),
      );
  for (const N of [6, 50, 200]) {
    const seed = buildSeed(N);
    bench(`rebuild        — N=${N}`, () => {
      const sim = buildFreshSim(seed);
      sim.stop();
    });
    const persistentSim = buildFreshSim(seed);
    persistentSim.stop();
    let toggle = 0;
    bench(`in-place update — N=${N}`, () => {
      const w = 280 + (toggle++ % 2);
      const h = 220 + (toggle % 2);
      persistentSim
        .force("center", forceCenter(w / 2, h / 2))
        .force("x", forceX<ResizeNode>(w / 2).strength(0.08))
        .force("y", forceY<ResizeNode>(h / 2).strength(0.08));
      persistentSim.alpha(0.3).restart();
      persistentSim.stop();
    });
  }
});

// Historical: pre-fix per-scroll-event cost. Post-fix uses IntersectionObserver
// (edge-triggered, not per-scroll), so this bench has no direct post-fix
// counterpart — kept as a baseline record of the cost the fix removed.
describe("scroll-spy update — review §10 (historical pre-fix: getBoundingClientRect per heading)", () => {
  function buildHeadings(H: number): { el: HTMLElement; id: string }[] {
    const arr: { el: HTMLElement; id: string }[] = [];
    for (let i = 0; i < H; i++) {
      const el = document.createElement("h2");
      el.id = `h-${i}`;
      document.body.appendChild(el);
      arr.push({ el, id: el.id });
    }
    return arr;
  }
  for (const H of [6, 20, 50]) {
    const headings = buildHeadings(H);
    bench(`H=${H}`, () => {
      const top = 80;
      let active: string | null = null;
      for (const { el } of headings) {
        if (el.getBoundingClientRect().top - top <= 0) {
          active = el.id;
        } else {
          break;
        }
      }
      void active;
    });
  }
});
