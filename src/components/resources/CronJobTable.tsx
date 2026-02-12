import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useResources } from "@/hooks/useResources";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import type { CronJobInfo } from "@/types/k8s";

export function CronJobTable() {
  const { data, loading, error, refresh } = useResources<CronJobInfo>();
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
              <TableHead>Schedule</TableHead>
              <TableHead>Suspend</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Last Schedule</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((cj) => (
              <TableRow key={cj.name} className="cursor-pointer" onClick={() => setSelectedResourceName(cj.name)}>
                <TableCell className="font-mono text-xs">{cj.name}</TableCell>
                <TableCell className="font-mono text-xs">{cj.schedule}</TableCell>
                <TableCell>
                  <Badge variant={cj.suspend ? "warning" : "secondary"}>
                    {cj.suspend ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell>{cj.active}</TableCell>
                <TableCell>{cj.last_schedule}</TableCell>
                <TableCell>{cj.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((cj) => (
            <ResourceCard
              key={cj.name}
              onClick={() => setSelectedResourceName(cj.name)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-mono text-sm font-medium">
                  {cj.name}
                </span>
                <Badge variant={cj.suspend ? "warning" : "secondary"}>
                  {cj.suspend ? "Suspended" : "Active"}
                </Badge>
              </div>
              <MetadataGrid>
                <span>Schedule: <span className="font-mono text-foreground">{cj.schedule}</span></span>
                <span>Active: <span className="text-foreground">{cj.active}</span></span>
                <span>Last: <span className="text-foreground">{cj.last_schedule}</span></span>
                <span>Age: <span className="text-foreground">{cj.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
