import { useState, useMemo } from "react";

type SortDir = "asc" | "desc";

export interface SortProps {
  isSorted: boolean;
  sortDir: SortDir | undefined;
  onClick: () => void;
}

export function useTableSort<T extends object>(items: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const getSortProps = (key: keyof T): SortProps => ({
    isSorted: sortKey === key,
    sortDir: sortKey === key ? sortDir : undefined,
    onClick: () => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
  });

  return { sortedItems, getSortProps };
}
