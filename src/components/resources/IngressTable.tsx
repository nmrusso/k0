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
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import type { IngressInfo } from "@/types/k8s";

export function IngressTable() {
  const { data, loading, error, refresh } = useResources<IngressInfo>();
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);

  return (
    <ResourceTableWrapper
      loading={loading}
      error={error}
      count={data.length}
      onRefresh={refresh}
    >
      {viewMode === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Hosts</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((ing) => (
              <TableRow
                key={ing.name}
                className="cursor-pointer"
                onClick={() => setSelectedIngress(ing.name)}
              >
                <TableCell className="font-mono text-xs">{ing.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ing.class}</Badge>
                </TableCell>
                <TableCell className="text-xs">{ing.hosts}</TableCell>
                <TableCell className="font-mono text-xs">
                  {ing.address}
                </TableCell>
                <TableCell>{ing.ports}</TableCell>
                <TableCell>{ing.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((ing) => (
            <ResourceCard
              key={ing.name}
              onClick={() => setSelectedIngress(ing.name)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-mono text-sm font-medium">
                  {ing.name}
                </span>
                <Badge variant="secondary">{ing.class}</Badge>
              </div>
              <MetadataGrid>
                <span className="col-span-2 truncate">
                  Hosts: <span className="text-foreground">{ing.hosts}</span>
                </span>
                <span>
                  Address:{" "}
                  <span className="font-mono text-foreground">
                    {ing.address}
                  </span>
                </span>
                <span>
                  Ports: <span className="text-foreground">{ing.ports}</span>
                </span>
                <span>
                  Age: <span className="text-foreground">{ing.age}</span>
                </span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
