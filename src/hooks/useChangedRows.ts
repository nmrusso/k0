import { useRef, useMemo } from "react";

/**
 * Tracks which items changed between the previous and current render.
 * Returns a Set of item keys that differ.
 *
 * @param items - Current list of items
 * @param getKey - Extract a unique key from an item (typically `name`)
 * @param getHash - Extract a comparison string from an item. If the hash
 *                  changes between renders, the item is considered "changed".
 */
export function useChangedRows<T>(
  items: T[],
  getKey: (item: T) => string,
  getHash: (item: T) => string,
): Set<string> {
  const prevMap = useRef<Map<string, string>>(new Map());

  const changedSet = useMemo(() => {
    const changed = new Set<string>();
    const currentMap = new Map<string, string>();

    for (const item of items) {
      const key = getKey(item);
      const hash = getHash(item);
      currentMap.set(key, hash);

      const prevHash = prevMap.current.get(key);
      // Only mark as changed if the item existed before with a different hash
      // (new items are not "changed")
      if (prevHash !== undefined && prevHash !== hash) {
        changed.add(key);
      }
    }

    prevMap.current = currentMap;
    return changed;
  }, [items, getKey, getHash]);

  return changedSet;
}
