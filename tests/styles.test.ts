import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

const cssUrl = new URL("../src/styles/global.css", import.meta.url);

let css = "";
beforeAll(async () => {
  css = await readFile(cssUrl, "utf-8");
});

describe("global.css — handoff token system", () => {
  it("defines the indigo brand-* scale (50..950)", () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(css).toMatch(new RegExp(`--brand-${step}:`));
    }
  });

  it("defines plain-language fg-* and bg-* aliases", () => {
    for (const i of [1, 2, 3, 4]) expect(css).toMatch(new RegExp(`--fg-${i}:`));
    for (const i of [1, 2, 3]) expect(css).toMatch(new RegExp(`--bg-${i}:`));
  });

  it("exposes brand and fg/bg aliases through @theme so Tailwind utilities work", () => {
    expect(css).toContain("--color-brand-600: var(--brand-600)");
    expect(css).toContain("--color-fg-1: var(--fg-1)");
    expect(css).toContain("--color-bg-1: var(--bg-1)");
  });

  it("preserves shadcn semantic tokens used by existing utility classes", () => {
    for (const name of [
      "background",
      "foreground",
      "card",
      "border",
      "muted-foreground",
      "accent",
    ]) {
      expect(css).toMatch(new RegExp(`--color-${name}:\\s*var\\(--${name}\\)`));
    }
  });

  it("provides a dark-mode override block", () => {
    expect(css).toMatch(/\.dark\s*\{[\s\S]*--fg-1:[\s\S]*--bg-1:[\s\S]*\}/);
  });

  it("preserves markdown-alert component classes from ADR-001", () => {
    for (const type of ["note", "tip", "important", "warning", "caution"]) {
      expect(css).toContain(`.markdown-alert-${type}`);
    }
  });
});

describe("global.css — accessibility polish (Phase 7)", () => {
  it("ships a brand-colored :focus-visible ring for keyboard users", () => {
    // Sanity: a single :focus-visible block exists with a brand outline.
    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*outline:[^}]*var\(--brand-500\)[^}]*\}/,
    );
  });

  it("respects prefers-reduced-motion globally", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation-duration:\s*0\.01ms\s*!important/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior:\s*auto\s*!important/,
    );
  });
});

describe("global.css — MaruBuri font weights", () => {
  it("maps each weight to exactly one matching font file", () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
      .map((match) => match[1])
      .filter((face) => /font-family:\s*"MaruBuri"/.test(face));

    expect(faces).toHaveLength(5);
    for (const [weight, file] of [
      [200, "ExtraLight"],
      [300, "Light"],
      [400, "Regular"],
      [600, "SemiBold"],
      [700, "Bold"],
    ] as const) {
      const matchingFaces = faces.filter((face) =>
        new RegExp(`font-weight:\\s*${weight}\\s*;`).test(face),
      );
      expect(matchingFaces).toHaveLength(1);
      expect(matchingFaces[0]).toContain(`MaruBuri-${file}.woff2`);
    }
  });
});
