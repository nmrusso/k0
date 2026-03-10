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
import type { ConfigMapInfo } from "@/types/k8s";

export function ConfigMapTable() {
  const { viewMode, setSelectedResourceName, visibleItems, wrapperProps } = useResourceTable<ConfigMapInfo>();

  return (
    <ResourceTableWrapper {...wrapperProps}>
      {viewMode === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((cm) => (
              <TableRow key={cm.name} className="cursor-pointer" onClick={() => setSelectedResourceName(cm.name)}>
                <TableCell className="font-mono text-xs">{cm.name}</TableCell>
                <TableCell>{cm.data_count}</TableCell>
                <TableCell>{cm.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((cm) => (
            <ResourceCard
              key={cm.name}
              onClick={() => setSelectedResourceName(cm.name)}
            >
              <div className="mb-2 truncate font-mono text-sm font-medium">
                {cm.name}
              </div>
              <MetadataGrid>
                <span>Data keys: <span className="text-foreground">{cm.data_count}</span></span>
                <span>Age: <span className="text-foreground">{cm.age}</span></span>
              </MetadataGrid>
            </ResourceCard>
          ))}
        </div>
      )}
    </ResourceTableWrapper>
  );
}
