import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TableProperties, LayoutGrid } from "lucide-react";
import { ErrorAlert } from "@/components/atoms";
import { useClusterStore } from "@/stores/clusterStore";
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
  children,
}: Props) {
  const viewMode = useClusterStore((s) => s.viewMode);
  const setViewMode = useClusterStore((s) => s.setViewMode);

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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
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
