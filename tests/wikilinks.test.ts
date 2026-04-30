import { describe, expect, it } from "vitest";

import { parseWikilinks } from "../src/lib/wikilinks";

describe("parseWikilinks", () => {
  it("returns an empty array for empty input", () => {
    expect(parseWikilinks("")).toEqual([]);
  });

  it("returns an empty array when no wikilinks are present", () => {
    expect(parseWikilinks("plain prose with no links")).toEqual([]);
  });

  it("extracts a basic [[Target]]", () => {
    const refs = parseWikilinks("see [[Foo Bar]] for context");
    expect(refs).toEqual([{ raw: "[[Foo Bar]]", target: "Foo Bar" }]);
  });

  it("extracts an aliased [[Target|alias]]", () => {
    const refs = parseWikilinks("see [[Foo|the foo]]");
    expect(refs).toEqual([
      { raw: "[[Foo|the foo]]", target: "Foo", alias: "the foo" },
    ]);
  });

  it("drops the heading from [[Target#heading]]", () => {
    const refs = parseWikilinks("see [[Foo#some-heading]]");
    expect(refs).toEqual([{ raw: "[[Foo#some-heading]]", target: "Foo" }]);
  });

  it("ignores image embeds (![[image.svg]])", () => {
    const refs = parseWikilinks("![[diagram.svg|650]]");
    expect(refs).toEqual([]);
  });

  it("ignores wikilinks inside inline code", () => {
    const refs = parseWikilinks("the syntax is `[[Foo]]` — fyi");
    expect(refs).toEqual([]);
  });

  it("ignores wikilinks inside fenced code blocks", () => {
    const md = "intro\n\n```\n[[Foo]]\nmore\n```\n\noutro";
    expect(parseWikilinks(md)).toEqual([]);
  });

  it("extracts multiple wikilinks from one document", () => {
    const refs = parseWikilinks("[[A]] and [[B|b]] and [[C#x]]");
    expect(refs).toEqual([
      { raw: "[[A]]", target: "A" },
      { raw: "[[B|b]]", target: "B", alias: "b" },
      { raw: "[[C#x]]", target: "C" },
    ]);
  });

  it("trims whitespace inside the brackets", () => {
    const refs = parseWikilinks("[[  Foo  ]]");
    expect(refs).toEqual([{ raw: "[[  Foo  ]]", target: "Foo" }]);
  });

  it("skips empty brackets [[]]", () => {
    expect(parseWikilinks("[[]] and [[ ]]")).toEqual([]);
  });
});
