import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { IconButton, SortableHead } from "@/components/atoms";
import { Trash2 } from "lucide-react";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { STATEFULSET_COORDS } from "@/lib/resource-coords";
import { useResourceTable } from "@/hooks/useResourceTable";
import { useResourceDelete } from "@/hooks/useResourceDelete";
import type { StatefulSetInfo } from "@/types/k8s";

export function StatefulSetTable() {
  const { refresh, viewMode, setSelectedResourceName, getSortProps, visibleItems, wrapperProps } = useResourceTable<StatefulSetInfo>();
  const del = useResourceDelete(STATEFULSET_COORDS, refresh);

  return (
    <>
      <ResourceTableWrapper {...wrapperProps}>
        {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" {...getSortProps("name")} />
                <SortableHead label="Ready" {...getSortProps("ready")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((ss) => (
                <TableRow key={ss.name} className="cursor-pointer" onClick={() => setSelectedResourceName(ss.name)}>
                  <TableCell className="font-mono text-xs">{ss.name}</TableCell>
                  <TableCell>{ss.ready}</TableCell>
                  <TableCell>{ss.age}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); del.open(ss.name); }}
                      variant="destructive"
                      title={`Delete ${ss.name}`}
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
            {visibleItems.map((ss) => (
              <ResourceCard
                key={ss.name}
                onClick={() => setSelectedResourceName(ss.name)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{ss.name}</span>
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); del.open(ss.name); }}
                    variant="destructive"
                    title={`Delete ${ss.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
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

      <BulkConfirmDialog {...del.dialogProps} />
    </>
  );
}
