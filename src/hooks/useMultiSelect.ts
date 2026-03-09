import { useState, useCallback } from "react";

export function useMultiSelect<T extends { name: string }>(items: T[]) {
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedNames(new Set(items.map((i) => i.name)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedNames(new Set());
  }, []);

  const isSelected = useCallback(
    (name: string) => selectedNames.has(name),
    [selectedNames],
  );

  const isAllSelected = items.length > 0 && selectedNames.size === items.length;

  return { selectedNames, toggleSelect, selectAll, clearSelection, isSelected, isAllSelected };
}
