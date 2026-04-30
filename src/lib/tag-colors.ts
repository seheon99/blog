// Eight oklch hues, distributed across the wheel. Lifted from the design
// handoff (`references/design_handoff/notebook/data.js`). The handoff maps
// known tag *categories* to slots; our content uses author-defined tags, so
// we pick a slot deterministically by hashing the tag string. This keeps a
// tag's color stable across renders without manual mapping.
export const TAG_PALETTE = [
  "oklch(0.55 0.18 256)", // indigo
  "oklch(0.62 0.16 195)", // teal
  "oklch(0.55 0.16 30)", //  warm orange
  "oklch(0.55 0.18 320)", // magenta
  "oklch(0.58 0.18 0)", //   red
  "oklch(0.62 0.13 100)", // olive
  "oklch(0.55 0.16 145)", // green
  "oklch(0.55 0.02 256)", // neutral
] as const;

const FALLBACK = "var(--brand-500)";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function tagColor(tag: string | undefined | null): string {
  if (!tag) return FALLBACK;
  const key = tag.trim().toLowerCase();
  if (!key) return FALLBACK;
  return TAG_PALETTE[hash(key) % TAG_PALETTE.length];
}
