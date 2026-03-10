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
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { IconButton, SortableHead } from "@/components/atoms";
import { PortForwardDialog } from "@/components/portforward/PortForwardDialog";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { SERVICE_COORDS } from "@/lib/resource-coords";
import { useResourceTable } from "@/hooks/useResourceTable";
import { useResourceDelete } from "@/hooks/useResourceDelete";
import type { ServiceInfo } from "@/types/k8s";

export function ServiceTable() {
  const { refresh, viewMode, setSelectedResourceName, getSortProps, visibleItems, wrapperProps } = useResourceTable<ServiceInfo>();
  const del = useResourceDelete(SERVICE_COORDS, refresh);
  const [pfOpen, setPfOpen] = useState(false);
  const [pfService, setPfService] = useState("");
  const [pfPort, setPfPort] = useState<number | undefined>();

  return (
    <>
    <ResourceTableWrapper {...wrapperProps}>
      {viewMode === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" {...getSortProps("name")} />
              <SortableHead label="Type" {...getSortProps("service_type")} />
              <SortableHead label="Cluster IP" {...getSortProps("cluster_ip")} />
              <SortableHead label="External IP" {...getSortProps("external_ip")} />
              <SortableHead label="Ports" {...getSortProps("ports")} />
              <SortableHead label="Age" {...getSortProps("age")} />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((svc) => (
              <TableRow key={svc.name} className="cursor-pointer" onClick={() => setSelectedResourceName(svc.name)}>
                <TableCell className="font-mono text-xs">{svc.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{svc.service_type}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{svc.cluster_ip}</TableCell>
                <TableCell className="font-mono text-xs">{svc.external_ip}</TableCell>
                <TableCell className="font-mono text-xs">{svc.ports}</TableCell>
                <TableCell>{svc.age}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
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
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); del.open(svc.name); }}
                      variant="destructive"
                      title={`Delete ${svc.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
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
                <span className="truncate font-mono text-sm font-medium">{svc.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary">{svc.service_type}</Badge>
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); del.open(svc.name); }}
                    variant="destructive"
                    title={`Delete ${svc.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
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

    <BulkConfirmDialog {...del.dialogProps} />
    </>
  );
}
