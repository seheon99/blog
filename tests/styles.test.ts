import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

const cssUrl = new URL("../src/styles/global.css", import.meta.url);
const fontsUrl = new URL("../src/styles/fonts/", import.meta.url);

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

describe("global.css — Pretendard self-hosting", () => {
  it("declares all 9 Pretendard weights via @font-face", () => {
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      const face = new RegExp(
        `@font-face\\s*\\{[^}]*Pretendard[^}]*${weight}[^}]*\\}`,
      );
      expect(css).toMatch(face);
    }
  });

  it("references self-hosted woff2 paths under ./fonts/", () => {
    expect(css).toMatch(/url\("\.\/fonts\/Pretendard-Regular\.woff2"\)/);
    expect(css).toMatch(/url\("\.\/fonts\/Pretendard-Bold\.woff2"\)/);
  });

  it("ships all 9 weight files in src/styles/fonts/", () => {
    const expected = [
      "Pretendard-Thin.woff2",
      "Pretendard-ExtraLight.woff2",
      "Pretendard-Light.woff2",
      "Pretendard-Regular.woff2",
      "Pretendard-Medium.woff2",
      "Pretendard-SemiBold.woff2",
      "Pretendard-Bold.woff2",
      "Pretendard-ExtraBold.woff2",
      "Pretendard-Black.woff2",
    ];
    for (const file of expected) {
      const fileUrl = new URL(file, fontsUrl);
      expect(existsSync(fileUrl)).toBe(true);
    }
  });
});
