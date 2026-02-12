import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfiniteScroll } from "./useInfiniteScroll";

function makeItems(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

// Mock IntersectionObserver
let observerCallback: IntersectionObserverCallback;
let mockObserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  const MockIntersectionObserver = function (this: any, callback: IntersectionObserverCallback) {
    observerCallback = callback;
    this.observe = mockObserve;
    this.disconnect = mockDisconnect;
    this.unobserve = vi.fn();
  } as unknown as typeof IntersectionObserver;

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

describe("useInfiniteScroll", () => {
  it("returns all items when count <= pageSize", () => {
    const items = makeItems(10);
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, pageSize: 50 }),
    );

    expect(result.current.visibleItems).toHaveLength(10);
    expect(result.current.totalCount).toBe(10);
    expect(result.current.visibleCount).toBe(10);
    expect(result.current.hasMore).toBe(false);
  });

  it("paginates when items exceed pageSize", () => {
    const items = makeItems(120);
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, pageSize: 50 }),
    );

    expect(result.current.visibleItems).toHaveLength(50);
    expect(result.current.totalCount).toBe(120);
    expect(result.current.visibleCount).toBe(50);
    expect(result.current.hasMore).toBe(true);
  });

  it("loads more when sentinel intersects", () => {
    const items = makeItems(120);
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, pageSize: 50 }),
    );

    // Simulate attaching sentinel
    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    // Simulate intersection
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(result.current.visibleCount).toBe(100);
    expect(result.current.hasMore).toBe(true);

    // Another intersection loads the rest
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(result.current.visibleCount).toBe(120);
    expect(result.current.hasMore).toBe(false);
  });

  it("reset restores to initial pageSize", () => {
    const items = makeItems(120);
    const { result } = renderHook(() =>
      useInfiniteScroll({ items, pageSize: 50 }),
    );

    // Load more
    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(result.current.visibleCount).toBe(100);

    // Reset
    act(() => {
      result.current.reset();
    });
    expect(result.current.visibleCount).toBe(50);
  });

  it("uses default pageSize of 50", () => {
    const items = makeItems(100);
    const { result } = renderHook(() => useInfiniteScroll({ items }));
    expect(result.current.visibleCount).toBe(50);
  });
});
