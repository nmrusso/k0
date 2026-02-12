import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResources } from "@/hooks/useResources";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import type { DaemonSetInfo } from "@/types/k8s";

export function DaemonSetTable() {
  const { data, loading, error, refresh } = useResources<DaemonSetInfo>();
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: data });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  return (
    <ResourceTableWrapper
      loading={loading}
      error={error}
      count={totalCount}
      visibleCount={visibleCount}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
      onRefresh={refresh}
    >
      {viewMode === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Desired</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Ready</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((ds) => (
              <TableRow key={ds.name} className="cursor-pointer" onClick={() => setSelectedResourceName(ds.name)}>
                <TableCell className="font-mono text-xs">{ds.name}</TableCell>
                <TableCell>{ds.desired}</TableCell>
                <TableCell>{ds.current}</TableCell>
                <TableCell>{ds.ready}</TableCell>
                <TableCell>{ds.available}</TableCell>
                <TableCell>{ds.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((ds) => (
            <ResourceCard
              key={ds.name}
              onClick={() => setSelectedResourceName(ds.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {ds.name}
              </div>
              <MetadataGrid>
                <span>Desired: <span className="text-foreground">{ds.desired}</span></span>
                <span>Current: <span className="text-foreground">{ds.current}</span></span>
                <span>Ready: <span className="text-foreground">{ds.ready}</span></span>
                <span>Available: <span className="text-foreground">{ds.available}</span></span>
                <span>Age: <span className="text-foreground">{ds.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
