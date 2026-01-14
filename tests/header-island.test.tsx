import { afterEach, describe, expect, it, vi } from "vitest";

const noopComponent = () => null;

vi.mock(
  "lucide-react",
  () => ({ LayoutGrid: noopComponent, Waypoints: noopComponent })
);
vi.mock(
  "@/components/ui/avatar",
  () => ({
    Avatar: noopComponent,
    AvatarImage: noopComponent,
    AvatarFallback: noopComponent,
  })
);
vi.mock("@/components/ui/button", () => ({ Button: noopComponent }));
vi.mock("@/components/ui/spinner", () => ({ Spinner: noopComponent }));
vi.mock(
  "@/components/ui/tooltip",
  () => ({
    Tooltip: noopComponent,
    TooltipContent: noopComponent,
    TooltipTrigger: noopComponent,
  })
);

const setLocation = (pathname: string) => {
  const existing = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    value: { pathname },
    configurable: true,
    writable: true,
  });

  return () => {
    if (existing) {
      Object.defineProperty(globalThis, "location", existing);
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  };
};

const renderWithPath = async (pathname: string) => {
  const restoreLocation = setLocation(pathname);
  const setView = vi.fn();
  const useEffect = vi.fn((callback: () => void) => callback());
  const useState = vi.fn(() => [undefined, setView]);

  vi.doMock("react", async () => {
    const actual = await vi.importActual<typeof import("react")>("react");
    return {
      ...actual,
      useEffect,
      useState,
    };
  });

  try {
    const { HeaderIsland } = await import(
      "../src/components/islands/header-island"
    );
    HeaderIsland();
  } finally {
    restoreLocation();
  }

  return { setView };
};

describe("HeaderIsland", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sets view to graph on /graph", async () => {
    const { setView } = await renderWithPath("/graph");
    expect(setView).toHaveBeenCalledWith("graph");
  });

  it("sets view to graph on /graph/", async () => {
    const { setView } = await renderWithPath("/graph/");
    expect(setView).toHaveBeenCalledWith("graph");
  });

  it("sets view to grid on /", async () => {
    const { setView } = await renderWithPath("/");
    expect(setView).toHaveBeenCalledWith("grid");
  });

  it("sets view to null on other paths", async () => {
    const { setView } = await renderWithPath("/posts/abc");
    expect(setView).toHaveBeenCalledWith(null);
  });
});
