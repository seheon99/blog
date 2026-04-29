import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import WritingRow from "@/components/post/writing-row.astro";

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(WritingRow, { props });
}

const baseProps = {
  href: "/posts/example",
  title: "Example post",
  description: "A short excerpt.",
  createdAt: new Date("2026-04-15T00:00:00Z"),
  readMinutes: 5,
  primaryTag: "javascript",
};

describe("WritingRow", () => {
  describe("with a primary tag", () => {
    let html: string;
    beforeAll(async () => {
      html = await render(baseProps);
    });

    it("links the row to the post href", () => {
      expect(html).toMatch(/<a[^>]*href="\/posts\/example"/);
    });

    it("renders the title and excerpt", () => {
      expect(html).toMatch(/>\s*Example post\s*</);
      expect(html).toMatch(/>\s*A short excerpt\.\s*</);
    });

    it("formats the date as an uppercased mono meta", () => {
      expect(html).toMatch(/APR \d{1,2}, 2026/);
    });

    it("shows the read-time label", () => {
      expect(html).toContain("5 MIN");
    });

    it("renders the primary tag with a # prefix", () => {
      expect(html).toContain("#javascript");
    });

    it("uses group + hover utilities for the 6px right shift", () => {
      expect(html).toMatch(/<a[^>]*class="[^"]*group[^"]*"/);
      expect(html).toMatch(/hover:pl-1\.5/);
    });

    it("titles get the brand-600 hover via group-hover", () => {
      expect(html).toMatch(/group-hover:text-brand-600/);
    });

    it("includes a machine-readable datetime attribute", () => {
      expect(html).toContain('datetime="2026-04-15T00:00:00.000Z"');
    });
  });

  describe("without a primary tag", () => {
    it("omits the tag segment entirely", async () => {
      const html = await render({ ...baseProps, primaryTag: undefined });
      expect(html).not.toContain("#");
    });
  });
});
