import { useState } from "react";
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
import { IconButton, SortableHead } from "@/components/atoms";
import { Trash2 } from "lucide-react";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { deleteResource } from "@/lib/tauri-commands";
import { DAEMONSET_COORDS } from "@/lib/resource-coords";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSearch } from "@/hooks/useTableSearch";
import type { DaemonSetInfo } from "@/types/k8s";

export function DaemonSetTable() {
  const { data, loading, error, refresh } = useResources<DaemonSetInfo>();
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
    await deleteResource(DAEMONSET_COORDS, deleteTarget);
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
                <SortableHead label="Desired" {...getSortProps("desired")} />
                <SortableHead label="Current" {...getSortProps("current")} />
                <SortableHead label="Ready" {...getSortProps("ready")} />
                <SortableHead label="Available" {...getSortProps("available")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-10" />
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
                  <TableCell>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(ds.name); }}
                      variant="destructive"
                      title={`Delete ${ds.name}`}
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
            {visibleItems.map((ds) => (
              <ResourceCard
                key={ds.name}
                onClick={() => setSelectedResourceName(ds.name)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{ds.name}</span>
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(ds.name); }}
                    variant="destructive"
                    title={`Delete ${ds.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
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
