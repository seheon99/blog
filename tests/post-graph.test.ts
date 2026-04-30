import { describe, expect, it, vi } from "vitest";

import {
  buildPostGraph,
  getBacklinks,
  type PostGraphInput,
} from "../src/lib/post-graph";

function post(
  id: string,
  title: string,
  body: string = "",
  tags?: string[],
): PostGraphInput {
  return { id, body, data: { title, tags } };
}

describe("buildPostGraph", () => {
  it("returns empty nodes and links for no posts", () => {
    expect(buildPostGraph([])).toEqual({ nodes: [], links: [] });
  });

  it("builds nodes with full post metadata", () => {
    const { nodes } = buildPostGraph([
      post("JavaScript/Symbol", "JS Symbol", "", ["JavaScript"]),
    ]);
    expect(nodes).toEqual([
      {
        id: "JavaScript/Symbol",
        href: "/posts/JavaScript/Symbol",
        title: "JS Symbol",
        description: "",
        createdAt: "",
        tags: ["JavaScript"],
        primaryTag: "JavaScript",
        readMinutes: 1,
      },
    ]);
  });

  it("creates an undirected link when one post wikilinks another by title", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[Beta]]"),
      post("b", "Beta"),
    ]);
    expect(links).toEqual([{ source: "a", target: "b" }]);
  });

  it("orders link endpoints lexicographically (source < target)", () => {
    const { links } = buildPostGraph([
      post("zeta", "Zeta", "ref [[Alpha]]"),
      post("alpha", "Alpha"),
    ]);
    expect(links).toEqual([{ source: "alpha", target: "zeta" }]);
  });

  it("dedupes mutual references into one link", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[Beta]]"),
      post("b", "Beta", "see [[Alpha]]"),
    ]);
    expect(links).toEqual([{ source: "a", target: "b" }]);
  });

  it("drops self-links", () => {
    const { links } = buildPostGraph([post("a", "Alpha", "see [[Alpha]]")]);
    expect(links).toEqual([]);
  });

  it("drops unresolvable wikilinks without throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { links } = buildPostGraph([post("a", "Alpha", "see [[Ghost]]")]);
    expect(links).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("resolves a wikilink whose target is a post id (path)", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[JavaScript/Symbol]]"),
      post("JavaScript/Symbol", "JS Symbol"),
    ]);
    expect(links).toEqual([
      { source: "JavaScript/Symbol", target: "a" },
    ]);
  });

  it("strips a trailing .md from the target before id matching", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[JavaScript/Symbol.md]]"),
      post("JavaScript/Symbol", "JS Symbol"),
    ]);
    expect(links).toEqual([
      { source: "JavaScript/Symbol", target: "a" },
    ]);
  });

  it("matches titles case-insensitively", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[beta]]"),
      post("b", "Beta"),
    ]);
    expect(links).toEqual([{ source: "a", target: "b" }]);
  });

  it("on title collision, prefers an exact id-path lookup over title", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[Folder/Dup]]"),
      post("Folder/Dup", "Dup"),
      post("Other/Dup", "Dup"),
    ]);
    expect(links).toEqual([{ source: "Folder/Dup", target: "a" }]);
  });

  it("on ambiguous title with no path hint, picks the lexicographically first id and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { links } = buildPostGraph([
      post("a", "Alpha", "see [[Dup]]"),
      post("z/Dup", "Dup"),
      post("a/Dup", "Dup"),
    ]);
    expect(links).toEqual([{ source: "a", target: "a/Dup" }]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores image embeds in the body", () => {
    const { links } = buildPostGraph([
      post("a", "Alpha", "![[diagram.svg|650]]"),
      post("diagram.svg", "Diagram"),
    ]);
    expect(links).toEqual([]);
  });
});

describe("getBacklinks", () => {
  it("returns an empty list when no post references the target", () => {
    const result = getBacklinks(
      [post("a", "Alpha"), post("b", "Beta")],
      "a",
    );
    expect(result).toEqual([]);
  });

  it("returns a post that references the target by title", () => {
    const result = getBacklinks(
      [post("a", "Alpha", "see [[Beta]]"), post("b", "Beta")],
      "b",
    );
    expect(result.map((n) => n.id)).toEqual(["a"]);
  });

  it("only includes incoming references (the target's outgoing refs do not count)", () => {
    // a → b; we look up backlinks for a, only b would qualify if it linked back.
    const result = getBacklinks(
      [post("a", "Alpha", "see [[Beta]]"), post("b", "Beta")],
      "a",
    );
    expect(result).toEqual([]);
  });

  it("excludes the target post itself even if its body wikilinks to itself", () => {
    const result = getBacklinks(
      [post("a", "Alpha", "I am [[Alpha]]")],
      "a",
    );
    expect(result).toEqual([]);
  });

  it("dedupes when one post references the target multiple times", () => {
    const result = getBacklinks(
      [
        post("a", "Alpha", "see [[Beta]] and again [[Beta]]"),
        post("b", "Beta"),
      ],
      "b",
    );
    expect(result.map((n) => n.id)).toEqual(["a"]);
  });

  it("collects multiple distinct posts that reference the target", () => {
    const result = getBacklinks(
      [
        post("a", "Alpha", "see [[Gamma]]"),
        post("b", "Beta", "also [[Gamma]]"),
        post("c", "Gamma"),
      ],
      "c",
    );
    expect(result.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("resolves wikilinks pointing to a post id (path)", () => {
    const result = getBacklinks(
      [
        post("a", "Alpha", "see [[JavaScript/Symbol]]"),
        post("JavaScript/Symbol", "JS Symbol"),
      ],
      "JavaScript/Symbol",
    );
    expect(result.map((n) => n.id)).toEqual(["a"]);
  });

  it("ignores image embeds in the body", () => {
    const result = getBacklinks(
      [post("a", "Alpha", "![[Beta]]"), post("b", "Beta")],
      "b",
    );
    expect(result).toEqual([]);
  });
});
