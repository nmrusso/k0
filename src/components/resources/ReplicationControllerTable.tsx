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
import type { ReplicationControllerInfo } from "@/types/k8s";

export function ReplicationControllerTable() {
  const { data, loading, error, refresh } =
    useResources<ReplicationControllerInfo>();
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
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((rc) => (
              <TableRow key={rc.name} className="cursor-pointer" onClick={() => setSelectedResourceName(rc.name)}>
                <TableCell className="font-mono text-xs">{rc.name}</TableCell>
                <TableCell>{rc.desired}</TableCell>
                <TableCell>{rc.current}</TableCell>
                <TableCell>{rc.ready}</TableCell>
                <TableCell>{rc.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((rc) => (
            <ResourceCard
              key={rc.name}
              onClick={() => setSelectedResourceName(rc.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {rc.name}
              </div>
              <MetadataGrid>
                <span>Desired: <span className="text-foreground">{rc.desired}</span></span>
                <span>Current: <span className="text-foreground">{rc.current}</span></span>
                <span>Ready: <span className="text-foreground">{rc.ready}</span></span>
                <span>Age: <span className="text-foreground">{rc.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
