import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClusterStore } from "@/stores/clusterStore";
import { helmListReleases } from "@/lib/tauri-commands";
import type { HelmRelease } from "@/types/k8s";
import { HelmReleaseDetail } from "./HelmReleaseDetail";
import { RefreshCw } from "lucide-react";

export function HelmReleasesView() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const [releases, setReleases] = useState<HelmRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    if (!activeContext || !activeNamespace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await helmListReleases();
      setReleases(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeContext, activeNamespace]);

  useEffect(() => {
    setSelectedRelease(null);
    fetchReleases();
  }, [fetchReleases]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Helm Releases</h2>
        <Button variant="ghost" size="sm" onClick={fetchReleases} className="h-7 px-2">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {releases.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No Helm releases found in this namespace.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Chart</TableHead>
              <TableHead>App Version</TableHead>
              <TableHead className="w-16">Rev</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((rel) => (
              <TableRow
                key={rel.name}
                className={`cursor-pointer ${selectedRelease === rel.name ? "bg-accent" : ""}`}
                onClick={() =>
                  setSelectedRelease(selectedRelease === rel.name ? null : rel.name)
                }
              >
                <TableCell className="font-medium text-sm">{rel.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rel.chart}</TableCell>
                <TableCell className="text-xs">{rel.app_version}</TableCell>
                <TableCell className="font-mono text-xs">{rel.revision}</TableCell>
                <TableCell>
                  <Badge
                    variant={rel.status === "deployed" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {rel.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{rel.updated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedRelease && (
        <div className="mt-6 rounded-md border border-border p-4">
          <HelmReleaseDetail
            releaseName={selectedRelease}
            onRollbackComplete={fetchReleases}
          />
        </div>
      )}
    </div>
  );
}
