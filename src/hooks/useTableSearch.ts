import { useMemo } from "react";

/**
 * Filters an array of objects by checking if any primitive field value
 * contains the search query (case-insensitive).
 */
export function useTableSearch<T extends object>(items: T[], query: string): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      Object.values(item).some((v) => {
        if (v == null) return false;
        if (typeof v === "string") return v.toLowerCase().includes(q);
        if (typeof v === "number") return String(v).includes(q);
        return false;
      }),
    );
  }, [items, query]);
}
