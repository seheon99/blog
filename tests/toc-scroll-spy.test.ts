// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  setupTocScrollSpy,
  type TocHeading,
} from "../src/lib/toc-scroll-spy";

interface Fixture {
  scrollRoot: HTMLElement;
  headings: TocHeading[];
  setTops: (tops: number[]) => void;
  teardown: () => void;
}

function setupFixture(slugs: string[]): Fixture {
  document.body.innerHTML = `
    <div data-scroll-root>
      <ul>
        ${slugs
          .map(
            (slug) =>
              `<li><a data-toc-link data-toc-slug="${slug}" href="#${slug}">${slug}</a></li>`,
          )
          .join("")}
      </ul>
      <article>
        ${slugs.map((slug) => `<h2 id="${slug}">${slug}</h2>`).join("")}
      </article>
    </div>
  `;

  const scrollRoot =
    document.querySelector<HTMLElement>("[data-scroll-root]")!;
  const headings: TocHeading[] = slugs.map((slug) => {
    const link = document.querySelector<HTMLAnchorElement>(
      `a[data-toc-slug="${slug}"]`,
    )!;
    const el = document.getElementById(slug)!;
    return { link, el };
  });

  // happy-dom returns zeroed rects (no layout). Stub each heading's
  // getBoundingClientRect so the spy can read realistic positions.
  const tops = new Map<HTMLElement, number>();
  for (const { el } of headings) tops.set(el, 1000);
  for (const { el } of headings) {
    el.getBoundingClientRect = () =>
      ({
        top: tops.get(el)!,
        bottom: tops.get(el)! + 24,
        left: 0,
        right: 0,
        width: 0,
        height: 24,
        x: 0,
        y: tops.get(el)!,
        toJSON: () => ({}),
      }) as DOMRect;
  }

  return {
    scrollRoot,
    headings,
    setTops: (next) => {
      next.forEach((t, i) => tops.set(headings[i].el, t));
    },
    teardown: () => {
      document.body.innerHTML = "";
    },
  };
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function activeSlug(headings: TocHeading[]): string | null {
  const hit = headings.find((h) => h.link.dataset.active === "true");
  return hit ? (hit.link.dataset.tocSlug ?? null) : null;
}

describe("setupTocScrollSpy", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = setupFixture(["a", "b", "c"]);
  });

  afterEach(() => {
    fx.teardown();
  });

  it("falls back to the first heading when nothing has scrolled past the line", async () => {
    fx.setTops([200, 400, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");
    teardown();
  });

  it("activates the last heading whose top has crossed the 80px reading line", async () => {
    fx.setTops([50, 300, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");

    fx.setTops([-100, 50, 400]);
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("b");

    fx.setTops([-400, -200, 60]);
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("c");
    teardown();
  });

  it("returns to the first heading after scrolling back above all headings", async () => {
    fx.setTops([-100, 50, 400]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("b");

    fx.setTops([200, 400, 600]);
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");
    teardown();
  });

  it("updates on window scroll (mobile body-scroll path)", async () => {
    fx.setTops([200, 400, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: null,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");

    fx.setTops([-100, 50, 400]);
    window.dispatchEvent(new Event("scroll"));
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("b");
    teardown();
  });

  it("updates on window resize", async () => {
    fx.setTops([200, 400, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");

    fx.setTops([-100, 50, 400]);
    window.dispatchEvent(new Event("resize"));
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("b");
    teardown();
  });

  it("respects a custom topOffset", async () => {
    fx.setTops([150, 300, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
      topOffset: 200,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");
    teardown();
  });

  it("coalesces bursts of scroll events into a single rAF tick", async () => {
    fx.setTops([200, 400, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();

    let calls = 0;
    for (const { el } of fx.headings) {
      const orig = el.getBoundingClientRect.bind(el);
      el.getBoundingClientRect = () => {
        calls++;
        return orig();
      };
    }

    fx.setTops([-100, 50, 400]);
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    await flushRaf();

    // One rAF tick reads each heading once.
    expect(calls).toBe(fx.headings.length);
    teardown();
  });

  it("removes its listeners on teardown", async () => {
    fx.setTops([200, 400, 600]);
    const teardown = setupTocScrollSpy({
      headings: fx.headings,
      scrollRoot: fx.scrollRoot,
    });
    await flushRaf();
    expect(activeSlug(fx.headings)).toBe("a");

    teardown();

    fx.setTops([-100, 50, 400]);
    fx.scrollRoot.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    await flushRaf();

    // Active should not have moved past the initial pick.
    expect(activeSlug(fx.headings)).toBe("a");
  });

  it("is a no-op when there are no headings", () => {
    const teardown = setupTocScrollSpy({
      headings: [],
      scrollRoot: fx.scrollRoot,
    });
    expect(typeof teardown).toBe("function");
    expect(() => teardown()).not.toThrow();
  });
});
