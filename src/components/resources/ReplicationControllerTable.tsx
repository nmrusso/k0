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
import { useResourceTable } from "@/hooks/useResourceTable";
import type { ReplicationControllerInfo } from "@/types/k8s";

export function ReplicationControllerTable() {
  const { viewMode, setSelectedResourceName, visibleItems, wrapperProps } = useResourceTable<ReplicationControllerInfo>();

  return (
    <ResourceTableWrapper {...wrapperProps}>
      {viewMode === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Desired</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Ready</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((rc) => (
              <TableRow key={rc.name} className="cursor-pointer" onClick={() => setSelectedResourceName(rc.name)}>
                <TableCell className="font-mono text-xs">{rc.name}</TableCell>
                <TableCell>{rc.desired}</TableCell>
                <TableCell>{rc.current}</TableCell>
                <TableCell>{rc.ready}</TableCell>
                <TableCell>{rc.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((rc) => (
            <ResourceCard
              key={rc.name}
              onClick={() => setSelectedResourceName(rc.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {rc.name}
              </div>
              <MetadataGrid>
                <span>Desired: <span className="text-foreground">{rc.desired}</span></span>
                <span>Current: <span className="text-foreground">{rc.current}</span></span>
                <span>Ready: <span className="text-foreground">{rc.ready}</span></span>
                <span>Age: <span className="text-foreground">{rc.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
