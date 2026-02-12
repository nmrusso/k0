import { useState, useMemo } from "react";
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
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SecretInfo } from "@/types/k8s";

function SecretTypeGroup({
  type,
  secrets,
  onSelect,
  viewMode,
}: {
  type: string;
  secrets: SecretInfo[];
  onSelect: (name: string) => void;
  viewMode: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 py-2 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Badge variant="secondary">{type}</Badge>
        <span className="text-muted-foreground text-xs">{secrets.length}</span>
      </button>
      {expanded && (
        viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((s) => (
                <TableRow key={s.name} className="cursor-pointer" onClick={() => onSelect(s.name)}>
                  <TableCell className="font-mono text-xs">{s.name}</TableCell>
                  <TableCell>{s.data_count}</TableCell>
                  <TableCell>{s.age}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-2 xl:grid-cols-3">
            {secrets.map((s) => (
              <ResourceCard
                key={s.name}
                onClick={() => onSelect(s.name)}
              >
                <div className="mb-2 truncate font-mono text-sm font-medium">
                  {s.name}
                </div>
                <MetadataGrid>
                  <span>Data keys: <span className="text-foreground">{s.data_count}</span></span>
                  <span>Age: <span className="text-foreground">{s.age}</span></span>
                </MetadataGrid>
              </ResourceCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function SecretTable() {
  const { data, loading, error, refresh } = useResources<SecretInfo>();
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: data });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  const grouped = useMemo(() => {
    const groups: Record<string, SecretInfo[]> = {};
    for (const s of visibleItems) {
      const type = s.secret_type || "Unknown";
      if (!groups[type]) groups[type] = [];
      groups[type].push(s);
    }
    // Sort groups by type name
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleItems]);

  return (
    <ResourceTableWrapper
      loading={loading}
      error={error}
      count={totalCount}
      visibleCount={visibleCount}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
      onRefresh={refresh}
    >
      <div className="space-y-1">
        {grouped.map(([type, secrets]) => (
          <SecretTypeGroup
            key={type}
            type={type}
            secrets={secrets}
            onSelect={setSelectedResourceName}
            viewMode={viewMode}
          />
        ))}
      </div>
    </ResourceTableWrapper>
  );
}
