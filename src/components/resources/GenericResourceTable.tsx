import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { useResources } from "@/hooks/useResources";
import { useClusterStore } from "@/stores/clusterStore";
import { CLUSTER_SCOPED_RESOURCES } from "@/lib/resource-coords";
import type { GenericResourceListItem } from "@/types/k8s";

export function GenericResourceTable() {
  const activeResource = useClusterStore((s) => s.activeResource);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const { data, loading, error, refresh } = useResources<GenericResourceListItem>();

  const isClusterScoped = CLUSTER_SCOPED_RESOURCES.has(activeResource);

  return (
    <ResourceTableWrapper
      loading={loading}
      error={error}
      count={data.length}
      onRefresh={refresh}
    >
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
            {data.map((item) => (
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
            {data.length === 0 && !loading && (
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
