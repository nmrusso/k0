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
import type { ConfigMapInfo } from "@/types/k8s";

export function ConfigMapTable() {
  const { data, loading, error, refresh } = useResources<ConfigMapInfo>();
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
              <TableHead>Data</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((cm) => (
              <TableRow key={cm.name} className="cursor-pointer" onClick={() => setSelectedResourceName(cm.name)}>
                <TableCell className="font-mono text-xs">{cm.name}</TableCell>
                <TableCell>{cm.data_count}</TableCell>
                <TableCell>{cm.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((cm) => (
            <ResourceCard
              key={cm.name}
              onClick={() => setSelectedResourceName(cm.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {cm.name}
              </div>
              <MetadataGrid>
                <span>Data keys: <span className="text-foreground">{cm.data_count}</span></span>
                <span>Age: <span className="text-foreground">{cm.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
