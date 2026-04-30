import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import TagChip from "@/components/ui/tag-chip.astro";
import TagChipsRow from "@/components/ui/tag-chips-row.astro";

async function render(
  Component: Parameters<AstroContainer["renderToString"]>[0],
  props: Record<string, unknown>,
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Component, { props });
}

describe("TagChip", () => {
  it("renders an anchor with rounded chip chrome and the label", async () => {
    const html = await render(TagChip, {
      tag: "javascript",
      href: "/?view=list&tag=javascript",
    });
    expect(html).toMatch(
      /<a[^>]*href="\/\?view=list(?:&|&#38;)tag=javascript"/,
    );
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/javascript/);
  });

  it("paints an inline-styled swatch dot keyed off the tag color", async () => {
    const html = await render(TagChip, {
      tag: "javascript",
      href: "/?tag=javascript",
    });
    expect(html).toMatch(/style="background-color:\s*oklch\(/);
  });

  it("uses 'all' label and no swatch when tag is null", async () => {
    const html = await render(TagChip, { tag: null, href: "/" });
    expect(html).toMatch(/>\s*all\s*</);
    expect(html).not.toContain("background-color: oklch");
  });

  it("flips data-current=true when active", async () => {
    const html = await render(TagChip, {
      tag: "javascript",
      href: "/?tag=javascript",
      active: true,
    });
    expect(html).toContain('data-current="true"');
  });
});

describe("TagChipsRow", () => {
  it("emits an 'all' chip plus one chip per tag", async () => {
    const html = await render(TagChipsRow, {
      tags: ["javascript", "docker", "git"],
      activeTag: null,
      baseHref: "/?view=list",
    });
    const chipCount = (html.match(/data-tag-chip/g) ?? []).length;
    expect(chipCount).toBe(4);
  });

  it("marks the active tag with data-current=true and others with false", async () => {
    const html = await render(TagChipsRow, {
      tags: ["javascript", "docker"],
      activeTag: "docker",
      baseHref: "/?view=list",
    });
    const dockerChip =
      html.match(/<a[^>]*data-tag="docker"[^>]*>/)?.[0] ?? "";
    // The "all" chip emits a bare `data-tag` (Astro serializes empty strings
    // as boolean attributes); match by the data-current attribute on the
    // first <a> instead.
    const allChip = html.match(/<a[^>]*>\s*all\s*<\/a>/)?.[0] ?? "";
    expect(dockerChip).toContain('data-current="true"');
    expect(allChip).toContain('data-current="false"');
  });

  it("preserves existing query string when building tag hrefs", async () => {
    const html = await render(TagChipsRow, {
      tags: ["javascript"],
      activeTag: null,
      baseHref: "/?view=graph",
    });
    // & gets HTML-entity-encoded as &#38; inside attribute values.
    expect(html).toMatch(/href="\/\?view=graph(?:&|&#38;)tag=javascript"/);
  });

  it("url-encodes tags with spaces or special chars", async () => {
    const html = await render(TagChipsRow, {
      tags: ["Data Structure"],
      activeTag: null,
      baseHref: "/?view=list",
    });
    expect(html).toContain("tag=Data%20Structure");
  });
});
