import { useEffect, useRef } from "react";

type HotkeyHandler = (e: KeyboardEvent) => void;
type HotkeyMap = Record<string, HotkeyHandler>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // CodeMirror editor
  if (target.closest(".cm-editor")) return true;
  // xterm.js terminal
  if (target.closest(".xterm")) return true;
  return false;
}

/**
 * Normalize a keyboard event to a hotkey string.
 * Examples: "j", "k", "Enter", "Escape", "Cmd+k", "Ctrl+k"
 */
function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Cmd");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Don't add modifier keys themselves as the key part
  if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }

  return parts.join("+");
}

/**
 * Global hotkey hook. Registers keydown handlers on document.
 * Skips events when focus is in editable elements (inputs, textareas, CodeMirror, xterm).
 *
 * Keys with modifiers (Cmd+k, Ctrl+k) are ALWAYS captured, even in editable contexts.
 * Plain keys (j, k, Enter, Escape) are only captured outside editable elements.
 */
export function useHotkeys(handlers: HotkeyMap, deps: unknown[] = []) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = eventToKey(e);
      const handler = handlersRef.current[key];
      if (!handler) return;

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

      // Plain keys are blocked in editable targets
      if (!hasModifier && isEditableTarget(e.target)) return;

      handler(e);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
