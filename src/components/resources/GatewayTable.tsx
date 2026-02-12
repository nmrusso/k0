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
import type { GatewayInfo } from "@/types/k8s";

export function GatewayTable() {
  const { data, loading, error, refresh } = useResources<GatewayInfo>();
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);

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
              <TableHead>Gateway Class</TableHead>
              <TableHead>Addresses</TableHead>
              <TableHead>Listeners</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((gw) => (
              <TableRow
                key={gw.name}
                className="cursor-pointer"
                onClick={() => setSelectedGateway(gw.name)}
              >
                <TableCell className="font-mono text-xs">{gw.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{gw.gateway_class}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {gw.addresses}
                </TableCell>
                <TableCell>{gw.listeners}</TableCell>
                <TableCell>{gw.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((gw) => (
            <ResourceCard
              key={gw.name}
              onClick={() => setSelectedGateway(gw.name)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-mono text-sm font-medium">
                  {gw.name}
                </span>
                <Badge variant="secondary">{gw.gateway_class}</Badge>
              </div>
              <MetadataGrid>
                <span>
                  Addresses:{" "}
                  <span className="font-mono text-foreground">
                    {gw.addresses}
                  </span>
                </span>
                <span>
                  Listeners:{" "}
                  <span className="text-foreground">{gw.listeners}</span>
                </span>
                <span>
                  Age: <span className="text-foreground">{gw.age}</span>
                </span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
