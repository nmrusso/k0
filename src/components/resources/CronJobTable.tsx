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
import { CRONJOB_COORDS } from "@/lib/resource-coords";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSearch } from "@/hooks/useTableSearch";
import type { CronJobInfo } from "@/types/k8s";

export function CronJobTable() {
  const { data, loading, error, refresh } = useResources<CronJobInfo>();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredData = useTableSearch(data, searchQuery);
  const { sortedItems, getSortProps } = useTableSort(filteredData);
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: sortedItems });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteResource(CRONJOB_COORDS, deleteTarget);
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" {...getSortProps("name")} />
                <SortableHead label="Schedule" {...getSortProps("schedule")} />
                <SortableHead label="Suspend" {...getSortProps("suspend")} />
                <SortableHead label="Active" {...getSortProps("active")} />
                <SortableHead label="Last Schedule" {...getSortProps("last_schedule")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-10" />
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
                  <TableCell>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(cj.name); }}
                      variant="destructive"
                      title={`Delete ${cj.name}`}
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
            {visibleItems.map((cj) => (
              <ResourceCard
                key={cj.name}
                onClick={() => setSelectedResourceName(cj.name)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="truncate font-mono text-sm font-medium">{cj.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={cj.suspend ? "warning" : "secondary"}>
                      {cj.suspend ? "Suspended" : "Active"}
                    </Badge>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(cj.name); }}
                      variant="destructive"
                      title={`Delete ${cj.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
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
