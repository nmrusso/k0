import { useState, useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions<T> {
  items: T[];
  pageSize?: number;
}

interface UseInfiniteScrollResult<T> {
  visibleItems: T[];
  totalCount: number;
  visibleCount: number;
  hasMore: boolean;
  sentinelRef: React.RefCallback<HTMLElement>;
  reset: () => void;
}

export function useInfiniteScroll<T>({
  items,
  pageSize = 50,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [limit, setLimit] = useState(pageSize);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const totalCount = items.length;
  const visibleCount = Math.min(limit, totalCount);
  const hasMore = visibleCount < totalCount;
  const visibleItems = items.slice(0, visibleCount);

  const reset = useCallback(() => {
    setLimit(pageSize);
  }, [pageSize]);

  // Grow limit when items grow beyond current limit (e.g. pod watch adds items)
  // but don't shrink it (avoid losing scroll position)
  useEffect(() => {
    if (totalCount <= pageSize) {
      setLimit(pageSize);
    }
  }, [totalCount, pageSize]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setLimit((prev) => Math.min(prev + pageSize, totalCount));
          }
        },
        { rootMargin: "200px" },
      );

      observerRef.current.observe(node);
    },
    [pageSize, totalCount],
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { visibleItems, totalCount, visibleCount, hasMore, sentinelRef, reset };
}
