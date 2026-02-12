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
import type { StatefulSetInfo } from "@/types/k8s";

export function StatefulSetTable() {
  const { data, loading, error, refresh } = useResources<StatefulSetInfo>();
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
              <TableHead>Ready</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((ss) => (
              <TableRow key={ss.name} className="cursor-pointer" onClick={() => setSelectedResourceName(ss.name)}>
                <TableCell className="font-mono text-xs">{ss.name}</TableCell>
                <TableCell>{ss.ready}</TableCell>
                <TableCell>{ss.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((ss) => (
            <ResourceCard
              key={ss.name}
              onClick={() => setSelectedResourceName(ss.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {ss.name}
              </div>
              <MetadataGrid>
                <span>Ready: <span className="text-foreground">{ss.ready}</span></span>
                <span>Age: <span className="text-foreground">{ss.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
