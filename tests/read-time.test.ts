import { describe, expect, it } from "vitest";

import { readMinutes, wordCount } from "@/lib/read-time";

describe("readMinutes", () => {
  it("returns at least 1 for an empty body", () => {
    expect(readMinutes("")).toBe(1);
    expect(readMinutes("hi")).toBe(1);
  });

  it("counts English words against ~250 wpm", () => {
    const body = Array(500).fill("word").join(" ");
    expect(readMinutes(body)).toBe(2);
  });

  it("counts Korean characters against ~500 cpm", () => {
    const body = "안".repeat(1000);
    expect(readMinutes(body)).toBe(2);
  });

  it("blends Korean and English in the same post", () => {
    const body = `${"안".repeat(500)} ${Array(250).fill("word").join(" ")}`;
    // 500/500 + 250/250 = 1 + 1 = 2 minutes
    expect(readMinutes(body)).toBe(2);
  });

  it("excludes fenced code blocks", () => {
    const codeOnly = "```\n" + Array(2000).fill("x").join(" ") + "\n```";
    expect(readMinutes(codeOnly)).toBe(1);
  });

  it("rounds up partial minutes", () => {
    const body = Array(260).fill("word").join(" ");
    expect(readMinutes(body)).toBe(2);
  });
});

describe("wordCount", () => {
  it("returns 0 for an empty body", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   \n  ")).toBe(0);
  });

  it("counts whitespace-separated tokens", () => {
    expect(wordCount("hello world")).toBe(2);
    expect(wordCount("  one   two\nthree\t\tfour  ")).toBe(4);
  });

  it("counts Korean 어절 as tokens", () => {
    expect(wordCount("AI 에이전트가 빠르게 발전하면서")).toBe(4);
  });

  it("excludes fenced code blocks", () => {
    const body = "intro words\n```\nlots of code here\n```\noutro";
    expect(wordCount(body)).toBe(3);
  });
});
