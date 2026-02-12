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
import { Button } from "@/components/ui/button";
import { useResources } from "@/hooks/useResources";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { PortForwardDialog } from "@/components/portforward/PortForwardDialog";
import { ArrowUpRight } from "lucide-react";
import type { ServiceInfo } from "@/types/k8s";

export function ServiceTable() {
  const { data, loading, error, refresh } = useResources<ServiceInfo>();
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: data });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const [pfOpen, setPfOpen] = useState(false);
  const [pfService, setPfService] = useState("");
  const [pfPort, setPfPort] = useState<number | undefined>();

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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cluster IP</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Age</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((svc) => (
              <TableRow key={svc.name} className="cursor-pointer" onClick={() => setSelectedResourceName(svc.name)}>
                <TableCell className="font-mono text-xs">{svc.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{svc.service_type}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {svc.cluster_ip}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {svc.external_ip}
                </TableCell>
                <TableCell className="font-mono text-xs">{svc.ports}</TableCell>
                <TableCell>{svc.age}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const portStr = svc.ports.split(",")[0]?.split("/")[0]?.trim();
                      const port = parseInt(portStr, 10);
                      setPfService(svc.name);
                      setPfPort(!isNaN(port) ? port : undefined);
                      setPfOpen(true);
                    }}
                    title="Port Forward"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((svc) => (
            <ResourceCard
              key={svc.name}
              onClick={() => setSelectedResourceName(svc.name)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-mono text-sm font-medium">
                  {svc.name}
                </span>
                <Badge variant="secondary">{svc.service_type}</Badge>
              </div>
              <MetadataGrid>
                <span>Cluster IP: <span className="font-mono text-foreground">{svc.cluster_ip}</span></span>
                <span>External: <span className="font-mono text-foreground">{svc.external_ip}</span></span>
                <span className="col-span-2">Ports: <span className="font-mono text-foreground">{svc.ports}</span></span>
                <span>Age: <span className="text-foreground">{svc.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>

    <PortForwardDialog
      open={pfOpen}
      onOpenChange={setPfOpen}
      targetKind="service"
      targetName={pfService}
      defaultPort={pfPort}
    />
    </>
  );
}
