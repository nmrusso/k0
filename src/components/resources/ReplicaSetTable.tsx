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
import type { ReplicaSetInfo } from "@/types/k8s";

export function ReplicaSetTable() {
  const { data, loading, error, refresh } = useResources<ReplicaSetInfo>();
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
            {visibleItems.map((rs) => (
              <TableRow key={rs.name} className="cursor-pointer" onClick={() => setSelectedResourceName(rs.name)}>
                <TableCell className="font-mono text-xs">{rs.name}</TableCell>
                <TableCell>{rs.desired}</TableCell>
                <TableCell>{rs.current}</TableCell>
                <TableCell>{rs.ready}</TableCell>
                <TableCell>{rs.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((rs) => (
            <ResourceCard
              key={rs.name}
              onClick={() => setSelectedResourceName(rs.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {rs.name}
              </div>
              <MetadataGrid>
                <span>Desired: <span className="text-foreground">{rs.desired}</span></span>
                <span>Current: <span className="text-foreground">{rs.current}</span></span>
                <span>Ready: <span className="text-foreground">{rs.ready}</span></span>
                <span>Age: <span className="text-foreground">{rs.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
