// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  setupTocScrollSpy,
  type TocHeading,
  type TocScrollSpyOptions,
} from "../src/lib/toc-scroll-spy";

interface Fixture {
  scrollRoot: HTMLElement;
  headings: TocHeading[];
  setTops: (tops: number[]) => void;
  start: (overrides?: Partial<TocScrollSpyOptions>) => void;
  tick: (target: EventTarget, eventName?: string) => Promise<void>;
  flush: () => Promise<void>;
  active: () => string | null;
}

const teardowns: Array<() => void> = [];

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
  const headings: TocHeading[] = slugs.map((slug) => ({
    link: document.querySelector<HTMLAnchorElement>(
      `a[data-toc-slug="${slug}"]`,
    )!,
    el: document.getElementById(slug)!,
  }));

  // happy-dom returns zeroed rects (no layout). Stub each heading's
  // getBoundingClientRect — only `.top` is read by the spy.
  const tops = new Map<HTMLElement, number>();
  for (const { el } of headings) {
    tops.set(el, 1000);
    el.getBoundingClientRect = () =>
      ({ top: tops.get(el)! }) as DOMRect;
  }

  const flush = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  return {
    scrollRoot,
    headings,
    flush,
    setTops: (next) => next.forEach((t, i) => tops.set(headings[i].el, t)),
    start: (overrides) => {
      teardowns.push(
        setupTocScrollSpy({ headings, scrollRoot, ...overrides }),
      );
    },
    tick: async (target, eventName = "scroll") => {
      target.dispatchEvent(new Event(eventName));
      await flush();
    },
    active: () => {
      const hit = headings.find((h) => h.link.dataset.active === "true");
      return hit ? (hit.link.dataset.tocSlug ?? null) : null;
    },
  };
}

describe("setupTocScrollSpy", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = setupFixture(["a", "b", "c"]);
  });

  afterEach(() => {
    while (teardowns.length) teardowns.pop()!();
    document.body.innerHTML = "";
  });

  it("falls back to the first heading when nothing has scrolled past the line", async () => {
    fx.setTops([200, 400, 600]);
    fx.start();
    await fx.flush();
    expect(fx.active()).toBe("a");
  });

  it("activates the last heading whose top has crossed the 80px reading line", async () => {
    fx.setTops([50, 300, 600]);
    fx.start();
    await fx.flush();
    expect(fx.active()).toBe("a");

    fx.setTops([-100, 50, 400]);
    await fx.tick(fx.scrollRoot);
    expect(fx.active()).toBe("b");

    fx.setTops([-400, -200, 60]);
    await fx.tick(fx.scrollRoot);
    expect(fx.active()).toBe("c");
  });

  it("returns to the first heading after scrolling back above all headings", async () => {
    fx.setTops([-100, 50, 400]);
    fx.start();
    await fx.flush();
    expect(fx.active()).toBe("b");

    fx.setTops([200, 400, 600]);
    await fx.tick(fx.scrollRoot);
    expect(fx.active()).toBe("a");
  });

  it("updates on window scroll (mobile body-scroll path)", async () => {
    fx.setTops([200, 400, 600]);
    fx.start({ scrollRoot: null });
    await fx.flush();
    expect(fx.active()).toBe("a");

    fx.setTops([-100, 50, 400]);
    await fx.tick(window);
    expect(fx.active()).toBe("b");
  });

  it("updates on window resize", async () => {
    fx.setTops([200, 400, 600]);
    fx.start();
    await fx.flush();

    fx.setTops([-100, 50, 400]);
    await fx.tick(window, "resize");
    expect(fx.active()).toBe("b");
  });

  it("respects a custom topOffset", async () => {
    fx.setTops([150, 300, 600]);
    fx.start({ topOffset: 200 });
    await fx.flush();
    expect(fx.active()).toBe("a");
  });

  it("coalesces bursts of scroll events into a single rAF tick", async () => {
    fx.setTops([200, 400, 600]);
    fx.start();
    await fx.flush();

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
    await fx.tick(fx.scrollRoot);

    // One rAF tick reads each heading once.
    expect(calls).toBe(fx.headings.length);
  });

  it("removes its listeners on teardown", async () => {
    fx.setTops([200, 400, 600]);
    fx.start();
    await fx.flush();
    expect(fx.active()).toBe("a");

    while (teardowns.length) teardowns.pop()!();

    fx.setTops([-100, 50, 400]);
    await fx.tick(fx.scrollRoot);
    await fx.tick(window);
    await fx.tick(window, "resize");
    expect(fx.active()).toBe("a");
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
