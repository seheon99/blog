import { describe, expect, it } from "vitest";

import { readMinutes } from "@/lib/read-time";

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
