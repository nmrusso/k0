import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { useClusterStore } from "@/stores/clusterStore";
import { CLUSTER_SCOPED_RESOURCES } from "@/lib/resource-coords";
import { useResourceTable } from "@/hooks/useResourceTable";
import type { GenericResourceListItem } from "@/types/k8s";

export function GenericResourceTable() {
  const activeResource = useClusterStore((s) => s.activeResource);
  const { loading, setSelectedResourceName, visibleItems, wrapperProps } = useResourceTable<GenericResourceListItem>();

  const isClusterScoped = CLUSTER_SCOPED_RESOURCES.has(activeResource);

  return (
    <ResourceTableWrapper {...wrapperProps}>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {!isClusterScoped && <TableHead>Namespace</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow
                key={`${item.namespace}/${item.name}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedResourceName(item.name)}
              >
                <TableCell className="font-mono text-sm">
                  {item.name}
                </TableCell>
                {!isClusterScoped && <TableCell>{item.namespace}</TableCell>}
                <TableCell>{item.status || "-"}</TableCell>
                <TableCell>{item.age}</TableCell>
              </TableRow>
            ))}
            {visibleItems.length === 0 && !loading && (
              <TableRow>
                <TableCell
                  colSpan={isClusterScoped ? 3 : 4}
                  className="text-center text-muted-foreground"
                >
                  No resources found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ResourceTableWrapper>
  );
}
