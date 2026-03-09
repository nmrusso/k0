import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TableProperties, LayoutGrid, Search, X } from "lucide-react";
import { ErrorAlert } from "@/components/atoms";
import { useClusterStore } from "@/stores/clusterStore";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";

interface Props {
  loading: boolean;
  error: string | null;
  count: number;
  visibleCount?: number;
  hasMore?: boolean;
  sentinelRef?: React.RefCallback<HTMLElement>;
  onRefresh: () => void;
  extraControls?: React.ReactNode;
  /** Auto-refresh interval in ms. Omit to disable. */
  autoRefreshIntervalMs?: number;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  children: React.ReactNode;
}

export function ResourceTableWrapper({
  loading,
  error,
  count,
  visibleCount,
  hasMore,
  sentinelRef,
  onRefresh,
  extraControls,
  autoRefreshIntervalMs,
  searchQuery,
  onSearchChange,
  children,
}: Props) {
  const viewMode = useClusterStore((s) => s.viewMode);
  const setViewMode = useClusterStore((s) => s.setViewMode);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh when interval is specified (0 disables)
  useAutoRefresh(onRefresh, autoRefreshIntervalMs ?? 0);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorAlert>{error}</ErrorAlert>;
  }

  return (
    <div>
      {onSearchChange && (
        <div className="mb-2 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              onClick={() => { onSearchChange(""); searchInputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {autoRefreshIntervalMs && (
            <span className="auto-refresh-dot h-1.5 w-1.5 rounded-full bg-emerald-500" title="Auto-refreshing" />
          )}
          {visibleCount != null && visibleCount < count
            ? `${visibleCount} of ${count} items`
            : `${count} items`}
        </span>
        <div className="flex items-center gap-1">
          {extraControls}
          <div className="flex items-center rounded-md border border-border">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center rounded-l-md px-2 py-1 transition-colors",
                viewMode === "table"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TableProperties className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center rounded-r-md px-2 py-1 transition-colors",
                viewMode === "cards"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>
      {children}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4 text-xs text-muted-foreground"
        >
          Loading more...
        </div>
      )}
    </div>
  );
}
