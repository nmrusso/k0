import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { GenericResourceDetail } from "./GenericResourceDetail";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useClusterStore } from "@/stores/clusterStore";
import { getCRDInstances } from "@/lib/tauri-commands";
import type { CRDInstanceInfo } from "@/types/k8s";

function parseCRDResource(activeResource: string) {
  // Format: "crd:group/version/plural/scope"
  const match = activeResource.match(/^crd:(.+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { group: match[1], version: match[2], plural: match[3], scope: match[4] };
}

export function CRDInstanceTable() {
  const activeResource = useClusterStore((s) => s.activeResource);
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const selectedResourceName = useClusterStore((s) => s.selectedResourceName);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  const [data, setData] = useState<CRDInstanceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseCRDResource(activeResource);

  const isClusterScoped = parsed?.scope === "Cluster";

  const refresh = useCallback(async () => {
    if (!parsed || !activeContext || (!activeNamespace && !isClusterScoped)) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getCRDInstances(parsed.group, parsed.version, parsed.plural, parsed.scope);
      setData(result);
    } catch (e) {
      setError(String(e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeResource, activeContext, activeNamespace, isClusterScoped]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!parsed) return null;

  return (
    <>
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
                <TableHead>Namespace</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={item.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedResourceName(item.name)}
                >
                  <TableCell className="font-mono text-sm">
                    {item.name}
                  </TableCell>
                  <TableCell>{item.namespace}</TableCell>
                  <TableCell>{item.age}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No instances found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ResourceTableWrapper>

      <Sheet
        open={!!selectedResourceName}
        onOpenChange={(open) => {
          if (!open) setSelectedResourceName(null);
        }}
      >
        <SheetContent>
          {parsed && (
            <GenericResourceDetail
              coords={{
                group: parsed.group,
                version: parsed.version,
                kind: parsed.plural,
                plural: parsed.plural,
                clusterScoped: parsed.scope === "Cluster",
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
