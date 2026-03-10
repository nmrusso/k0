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
import { REPLICASET_COORDS } from "@/lib/resource-coords";
import { useResourceTable } from "@/hooks/useResourceTable";
import { useResourceDelete } from "@/hooks/useResourceDelete";
import type { ReplicaSetInfo } from "@/types/k8s";

export function ReplicaSetTable() {
  const { refresh, viewMode, setSelectedResourceName, getSortProps, visibleItems, wrapperProps } = useResourceTable<ReplicaSetInfo>();
  const del = useResourceDelete(REPLICASET_COORDS, refresh);

  return (
    <>
      <ResourceTableWrapper {...wrapperProps}>
        {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" {...getSortProps("name")} />
                <SortableHead label="Desired" {...getSortProps("desired")} />
                <SortableHead label="Current" {...getSortProps("current")} />
                <SortableHead label="Ready" {...getSortProps("ready")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-10" />
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
                  <TableCell>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); del.open(rs.name); }}
                      variant="destructive"
                      title={`Delete ${rs.name}`}
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
            {visibleItems.map((rs) => (
              <ResourceCard
                key={rs.name}
                onClick={() => setSelectedResourceName(rs.name)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{rs.name}</span>
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); del.open(rs.name); }}
                    variant="destructive"
                    title={`Delete ${rs.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
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

      <BulkConfirmDialog {...del.dialogProps} />
    </>
  );
}
