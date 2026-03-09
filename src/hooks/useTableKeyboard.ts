import { useState, useCallback } from "react";
import { useHotkeys } from "./useHotkeys";

interface UseTableKeyboardOptions<T> {
  items: T[];
  /** Called when Enter is pressed on a focused row */
  onSelect?: (item: T, index: number) => void;
  /** Called when Escape is pressed */
  onEscape?: () => void;
  /** Additional per-key handlers. Key is the hotkey string (e.g. "l", "s", "d"). */
  actions?: Record<string, (item: T, index: number) => void>;
}

interface UseTableKeyboardReturn {
  /** Currently focused row index (-1 = none) */
  focusedIndex: number;
  /** Set focused index programmatically */
  setFocusedIndex: (index: number) => void;
  /** Returns props to spread on a TableRow for keyboard focus styling */
  getRowProps: (index: number) => {
    "data-focused": boolean;
    className: string;
  };
}

export function useTableKeyboard<T>({
  items,
  onSelect,
  onEscape,
  actions,
}: UseTableKeyboardOptions<T>): UseTableKeyboardReturn {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handlers: Record<string, (e: KeyboardEvent) => void> = {
    j: (e) => {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.min(prev + 1, items.length - 1);
        return Math.max(next, 0);
      });
    },
    k: (e) => {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    },
    Enter: (e) => {
      if (focusedIndex >= 0 && focusedIndex < items.length && onSelect) {
        e.preventDefault();
        onSelect(items[focusedIndex], focusedIndex);
      }
    },
    Escape: (e) => {
      if (focusedIndex >= 0) {
        e.preventDefault();
        setFocusedIndex(-1);
      } else if (onEscape) {
        e.preventDefault();
        onEscape();
      }
    },
  };

  // Register custom actions
  if (actions) {
    for (const [key, action] of Object.entries(actions)) {
      handlers[key] = (e) => {
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          e.preventDefault();
          action(items[focusedIndex], focusedIndex);
        }
      };
    }
  }

  useHotkeys(handlers, [focusedIndex, items.length]);

  const getRowProps = useCallback(
    (index: number) => ({
      "data-focused": index === focusedIndex,
      className: index === focusedIndex ? "ring-1 ring-primary ring-inset bg-accent/50" : "",
    }),
    [focusedIndex],
  );

  return { focusedIndex, setFocusedIndex, getRowProps };
}
