import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAG_PALETTE } from "../src/lib/tag-colors";

const css = readFileSync(
  new URL("../src/styles/global.css", import.meta.url),
  "utf8",
);
const lightTokens = css.match(/:root\s*\{([\s\S]*?)\}/)![1];
const darkTokens = css.match(/\.dark\s*\{([\s\S]*?)\}/)![1];

function luminance(token: string, theme: string): number {
  const declaration = new RegExp(`--${token}:\\s*([^;]+)`);
  const value = theme.match(declaration)?.[1] ?? lightTokens.match(declaration)?.[1];
  if (!value) throw new Error(`Missing palette token: ${token}`);

  const alias = value.match(/var\(--([\w-]+)\)/);
  if (alias) return luminance(alias[1], theme);

  const oklch = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (oklch) return oklchLuminance(oklch.slice(1).map(Number));

  const hex = value.match(/^#([\da-f]{6})$/i);
  if (!hex) throw new Error(`Unsupported palette color: ${value}`);
  const linearRgb = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linearRgb[0] * 0.2126 + linearRgb[1] * 0.7152 + linearRgb[2] * 0.0722;
}

// Convert OKLCH through OKLab to linear sRGB, clipping out-of-gamut channels
// as the browser's sRGB canvas does. WCAG contrast uses relative luminance.
function oklchLuminance([lightness, chroma, hue]: number[]): number {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linearRgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(channel => Math.min(1, Math.max(0, channel)));
  return linearRgb[0] * 0.2126 + linearRgb[1] * 0.7152 + linearRgb[2] * 0.0722;
}

function contrast(foreground: number, background: number): number {
  return (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05);
}

const readingSurfaces = ["bg-1", "bg-2", "bg-3", "card", "popover", "muted"];

describe("reading palette contrast", () => {
  for (const [name, theme] of [["light", lightTokens], ["dark", darkTokens]]) {
    it(`${name} secondary text has at least 5:1 on every reading surface`, () => {
      for (const surface of readingSurfaces) {
        const ratio = contrast(luminance("fg-3", theme), luminance(surface, theme));
        expect(ratio, surface).toBeGreaterThanOrEqual(5);
      }
    });

    it(`${name} graph nodes have at least 3:1 against both graph surfaces`, () => {
      for (const nodeColor of TAG_PALETTE) {
        const channels = nodeColor.match(/oklch\(([^)]+)\)/)![1].split(" ").map(Number);
        for (const surface of ["bg-1", "bg-2"]) {
          const ratio = contrast(oklchLuminance(channels), luminance(surface, theme));
          expect(ratio, `${nodeColor} on ${surface}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`${name} card focus ring has at least 3:1 against adjacent surfaces`, () => {
      for (const surface of ["bg-1", "card"]) {
        const ratio = contrast(luminance("ring", theme), luminance(surface, theme));
        expect(ratio, surface).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
