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
import type { JobInfo } from "@/types/k8s";

function jobStatusVariant(status: string) {
  if (status === "Complete") return "success" as const;
  if (status === "Running") return "warning" as const;
  return "destructive" as const;
}

export function JobTable() {
  const { data, loading, error, refresh } = useResources<JobInfo>();
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
              <TableHead>Completions</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((job) => (
              <TableRow key={job.name} className="cursor-pointer" onClick={() => setSelectedResourceName(job.name)}>
                <TableCell className="font-mono text-xs">{job.name}</TableCell>
                <TableCell>{job.completions}</TableCell>
                <TableCell>{job.duration}</TableCell>
                <TableCell>
                  <Badge variant={jobStatusVariant(job.status)}>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell>{job.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((job) => (
            <ResourceCard
              key={job.name}
              onClick={() => setSelectedResourceName(job.name)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-mono text-sm font-medium">
                  {job.name}
                </span>
                <Badge variant={jobStatusVariant(job.status)}>
                  {job.status}
                </Badge>
              </div>
              <MetadataGrid>
                <span>Completions: <span className="text-foreground">{job.completions}</span></span>
                <span>Duration: <span className="text-foreground">{job.duration}</span></span>
                <span>Age: <span className="text-foreground">{job.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
