export interface TocHeading {
  link: HTMLAnchorElement;
  el: HTMLElement;
}

export interface TocScrollSpyOptions {
  headings: TocHeading[];
  scrollRoot: HTMLElement | null;
  topOffset?: number;
}

// Listens to scroll/resize on both the inner [data-scroll-root] (desktop
// overflow scroller) and window (mobile body scroll) and toggles
// data-active="true" on the link for the last heading whose top has
// crossed the reading line at y=topOffset. Returns a teardown.
export function setupTocScrollSpy({
  headings,
  scrollRoot,
  topOffset = 80,
}: TocScrollSpyOptions): () => void {
  if (headings.length === 0) return () => {};

  function setActive(slug: string | null) {
    for (const { link } of headings) {
      link.dataset.active = link.dataset.tocSlug === slug ? "true" : "false";
    }
  }

  let pending = false;
  function update() {
    pending = false;
    let active: string | null = null;
    for (const { el } of headings) {
      if (el.getBoundingClientRect().top - topOffset <= 0) {
        active = el.id;
      } else {
        break;
      }
    }
    setActive(active ?? headings[0]?.el.id ?? null);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  scrollRoot?.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();

  return () => {
    scrollRoot?.removeEventListener("scroll", schedule);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}
