import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { useCommandSearch } from "@/hooks/useCommandSearch";
import { useClusterStore } from "@/stores/clusterStore";
import { useTabStore } from "@/stores/tabStore";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { results, loading } = useCommandSearch(query, open);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openTab = useTabStore((s) => s.openTab);
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset focused index when results change
  useEffect(() => {
    setFocusedIndex(0);
  }, [results.length]);

  const selectResult = useCallback(
    (idx: number) => {
      const result = results[idx];
      if (!result) return;

      openTab(result.resourceType);

      // Open detail sheet
      if (result.resourceType === "pods") setSelectedPod(result.name);
      else if (result.resourceType === "ingresses") setSelectedIngress(result.name);
      else if (result.resourceType === "gateways") setSelectedGateway(result.name);
      else setSelectedResourceName(result.name);

      onOpenChange(false);
    },
    [results, openTab, setSelectedPod, setSelectedIngress, setSelectedGateway, setSelectedResourceName, onOpenChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(focusedIndex);
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.children[focusedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0" onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources..."
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1">
          {results.length === 0 && query && !loading && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
          {results.length === 0 && !query && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search across all resources...
            </div>
          )}
          {results.map((result, idx) => (
            <button
              key={`${result.resourceType}-${result.name}`}
              onClick={() => selectResult(idx)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                idx === focusedIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex-1 truncate text-left font-mono text-xs">
                {result.name}
              </span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {result.typeLabel}
              </Badge>
            </button>
          ))}
        </div>

        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          <span className="mr-3"><kbd className="rounded border border-border px-1">↑↓</kbd> navigate</span>
          <span className="mr-3"><kbd className="rounded border border-border px-1">↵</kbd> open</span>
          <span><kbd className="rounded border border-border px-1">esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
