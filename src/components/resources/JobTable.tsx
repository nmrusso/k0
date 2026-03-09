import { useState } from "react";
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
import { IconButton, SortableHead } from "@/components/atoms";
import { Trash2 } from "lucide-react";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { deleteResource } from "@/lib/tauri-commands";
import { JOB_COORDS } from "@/lib/resource-coords";
import { useTableSort } from "@/hooks/useTableSort";
import type { JobInfo } from "@/types/k8s";

function jobStatusVariant(status: string) {
  if (status === "Complete") return "success" as const;
  if (status === "Running") return "warning" as const;
  return "destructive" as const;
}

export function JobTable() {
  const { data, loading, error, refresh } = useResources<JobInfo>();
  const { sortedItems, getSortProps } = useTableSort(data);
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: sortedItems });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteResource(JOB_COORDS, deleteTarget);
    refresh();
  };

  return (
    <>
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
                <SortableHead label="Name" {...getSortProps("name")} />
                <SortableHead label="Completions" {...getSortProps("completions")} />
                <SortableHead label="Duration" {...getSortProps("duration")} />
                <SortableHead label="Status" {...getSortProps("status")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((job) => (
                <TableRow key={job.name} className="cursor-pointer" onClick={() => setSelectedResourceName(job.name)}>
                  <TableCell className="font-mono text-xs">{job.name}</TableCell>
                  <TableCell>{job.completions}</TableCell>
                  <TableCell>{job.duration}</TableCell>
                  <TableCell>
                    <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell>{job.age}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(job.name); }}
                      variant="destructive"
                      title={`Delete ${job.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </TableCell>
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
                  <span className="truncate font-mono text-sm font-medium">{job.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(job.name); }}
                      variant="destructive"
                      title={`Delete ${job.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
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

      <BulkConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        action="delete"
        resourceNames={deleteTarget ? [deleteTarget] : []}
        onConfirm={handleDelete}
      />
    </>
  );
}
