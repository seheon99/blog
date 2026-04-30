import { describe, expect, it } from "vitest";

import { TAG_PALETTE, tagColor } from "../src/lib/tag-colors";

describe("tagColor", () => {
  it("returns a fallback for empty / nullish input", () => {
    expect(tagColor(undefined)).toBe("var(--brand-500)");
    expect(tagColor(null)).toBe("var(--brand-500)");
    expect(tagColor("")).toBe("var(--brand-500)");
    expect(tagColor("   ")).toBe("var(--brand-500)");
  });

  it("returns a color drawn from the 8-color oklch palette", () => {
    const c = tagColor("javascript");
    expect(TAG_PALETTE).toContain(c);
  });

  it("is deterministic across calls", () => {
    expect(tagColor("javascript")).toBe(tagColor("javascript"));
    expect(tagColor("docker")).toBe(tagColor("docker"));
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(tagColor("Docker")).toBe(tagColor("docker"));
    expect(tagColor("  docker ")).toBe(tagColor("docker"));
  });

  it("distributes distinct tags across multiple palette slots", () => {
    const colors = new Set([
      tagColor("javascript"),
      tagColor("docker"),
      tagColor("git"),
      tagColor("graphql"),
      tagColor("ai"),
      tagColor("rag"),
      tagColor("wazuh"),
      tagColor("algorithm"),
    ]);
    // We don't expect a perfect 8/8 hit (hash collisions are fine), but the
    // palette must spread to more than two slots for any reasonable input.
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });
});
