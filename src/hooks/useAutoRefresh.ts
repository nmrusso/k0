import { useEffect, useRef } from "react";

/**
 * Periodically calls `refresh()` at the given interval.
 * Skips the initial call (assumes the caller already triggers an initial fetch).
 * Pauses while a refresh is in-flight to avoid overlapping requests.
 */
export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs: number) {
  const refreshRef = useRef<() => void | Promise<void>>(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!intervalMs) return; // 0 = disabled

    let inFlight = false;

    const id = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await refreshRef.current();
      } finally {
        inFlight = false;
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);
}
