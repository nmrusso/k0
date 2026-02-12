import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResources } from "@/hooks/useResources";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { usePanelStore } from "@/stores/panelStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { IconButton } from "@/components/atoms";
import {
  ScrollText,
  Scaling,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Minus,
  Plus,
  RefreshCcw,
} from "lucide-react";
import {
  scaleDeployment,
  restartDeployment,
  getDeploymentInfo,
  updateDeploymentResources,
  getExternalSecretsForDeployment,
  forceSyncExternalSecret,
} from "@/lib/tauri-commands";
import type { DeploymentInfo } from "@/types/k8s";

// --- Scale Dialog ---
function ScaleDialog({
  open,
  onOpenChange,
  deploymentName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentName: string;
  onDone: () => void;
}) {
  const [currentReplicas, setCurrentReplicas] = useState(0);
  const [desired, setDesired] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError(null);
    getDeploymentInfo(deploymentName)
      .then((info) => {
        setCurrentReplicas(info.replicas);
        setDesired(info.replicas);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setFetching(false));
  }, [open, deploymentName]);

  const handleScale = async () => {
    setLoading(true);
    setError(null);
    try {
      await scaleDeployment(deploymentName, desired);
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scale Deployment</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {deploymentName}
          </DialogDescription>
        </DialogHeader>
        {fetching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm">
              Current replicas: <span className="font-semibold">{currentReplicas}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Desired replicas</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDesired(Math.max(0, desired - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={desired}
                  onChange={(e) => setDesired(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDesired(desired + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleScale} disabled={loading}>
                {loading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Scale
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Resources Dialog ---
function ResourcesDialog({
  open,
  onOpenChange,
  deploymentName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentName: string;
  onDone: () => void;
}) {
  const [containers, setContainers] = useState<
    { name: string; requests_cpu: string; requests_memory: string; limits_cpu: string; limits_memory: string }[]
  >([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [reqCpu, setReqCpu] = useState("");
  const [reqMem, setReqMem] = useState("");
  const [limCpu, setLimCpu] = useState("");
  const [limMem, setLimMem] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError(null);
    getDeploymentInfo(deploymentName)
      .then((info) => {
        setContainers(info.containers);
        if (info.containers.length > 0) {
          const c = info.containers[0];
          setReqCpu(c.requests_cpu);
          setReqMem(c.requests_memory);
          setLimCpu(c.limits_cpu);
          setLimMem(c.limits_memory);
          setSelectedIdx(0);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setFetching(false));
  }, [open, deploymentName]);

  const selectContainer = (idx: number) => {
    setSelectedIdx(idx);
    const c = containers[idx];
    if (c) {
      setReqCpu(c.requests_cpu);
      setReqMem(c.requests_memory);
      setLimCpu(c.limits_cpu);
      setLimMem(c.limits_memory);
    }
  };

  const handleSave = async () => {
    const c = containers[selectedIdx];
    if (!c) return;
    setLoading(true);
    setError(null);
    try {
      await updateDeploymentResources(
        deploymentName,
        c.name,
        reqCpu,
        reqMem,
        limCpu,
        limMem,
      );
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Resources</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {deploymentName}
          </DialogDescription>
        </DialogHeader>
        {fetching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {containers.length > 1 && (
              <div className="flex gap-1">
                {containers.map((c, i) => (
                  <Button
                    key={c.name}
                    variant={i === selectedIdx ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectContainer(i)}
                    className="text-xs"
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
            {containers.length === 1 && (
              <div className="text-sm text-muted-foreground">
                Container: <span className="font-mono text-foreground">{containers[0].name}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Requests CPU</label>
                <Input
                  value={reqCpu}
                  onChange={(e) => setReqCpu(e.target.value)}
                  placeholder="100m"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Requests Memory</label>
                <Input
                  value={reqMem}
                  onChange={(e) => setReqMem(e.target.value)}
                  placeholder="128Mi"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Limits CPU</label>
                <Input
                  value={limCpu}
                  onChange={(e) => setLimCpu(e.target.value)}
                  placeholder="500m"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Limits Memory</label>
                <Input
                  value={limMem}
                  onChange={(e) => setLimMem(e.target.value)}
                  placeholder="256Mi"
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Apply
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Main DeploymentTable ---
export function DeploymentTable() {
  const { data, loading, error, refresh } = useResources<DeploymentInfo>();
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: data });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const openLogTab = usePanelStore((s) => s.openLogTab);

  const [scaleTarget, setScaleTarget] = useState<string | null>(null);
  const [resourcesTarget, setResourcesTarget] = useState<string | null>(null);
  const [restartingName, setRestartingName] = useState<string | null>(null);
  const [syncingName, setSyncingName] = useState<string | null>(null);

  const handleOpenLogs = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    openLogTab({
      targetKind: "deployment",
      targetName: name,
      title: `deploy/${name}`,
    });
  };

  const handleRestart = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setRestartingName(name);
    try {
      await restartDeployment(name);
      refresh();
    } catch {
      // ignore
    } finally {
      setRestartingName(null);
    }
  };

  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncRestart = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setSyncingName(name);
    setSyncError(null);
    try {
      const matches = await getExternalSecretsForDeployment(name);
      if (matches.length === 0) {
        setSyncError(`No ExternalSecrets found for ${name}`);
        return;
      }
      for (const m of matches) {
        await forceSyncExternalSecret(m.external_secret_name, name);
      }
      refresh();
    } catch (err) {
      setSyncError(`Sync failed: ${err}`);
    } finally {
      setSyncingName(null);
    }
  };

  const ActionButtons = ({ name }: { name: string }) => (
    <div className="flex items-center gap-0.5">
      <IconButton
        onClick={(e) => { e.stopPropagation(); setScaleTarget(name); }}
        title="Scale"
      >
        <Scaling className="h-4 w-4" />
      </IconButton>
      <IconButton
        onClick={(e) => { e.stopPropagation(); setResourcesTarget(name); }}
        title="Edit resources"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </IconButton>
      <button
        onClick={(e) => handleRestart(e, name)}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Restart (rollout restart)"
        disabled={restartingName === name}
      >
        {restartingName === name ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
      </button>
      <button
        onClick={(e) => handleSyncRestart(e, name)}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Sync secrets & restart"
        disabled={syncingName === name}
      >
        {syncingName === name ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCcw className="h-4 w-4" />
        )}
      </button>
      <IconButton
        onClick={(e) => handleOpenLogs(e, name)}
        title={`View logs for ${name}`}
      >
        <ScrollText className="h-4 w-4" />
      </IconButton>
    </div>
  );

  return (
    <>
      {syncError && (
        <div className="mx-2 mb-2 flex items-center justify-between rounded border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <span>{syncError}</span>
          <button onClick={() => setSyncError(null)} className="ml-2 hover:text-foreground">✕</button>
        </div>
      )}
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
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((dep) => (
                <TableRow key={dep.name} className="cursor-pointer" onClick={() => setSelectedResourceName(dep.name)}>
                  <TableCell className="font-mono text-xs">{dep.name}</TableCell>
                  <TableCell>{dep.ready}</TableCell>
                  <TableCell>{dep.up_to_date}</TableCell>
                  <TableCell>{dep.available}</TableCell>
                  <TableCell>{dep.age}</TableCell>
                  <TableCell>
                    <ActionButtons name={dep.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((dep) => (
              <ResourceCard
                key={dep.name}
                onClick={() => setSelectedResourceName(dep.name)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">
                    {dep.name}
                  </span>
                  <ActionButtons name={dep.name} />
                </div>
                <MetadataGrid>
                  <span>Ready: <span className="text-foreground">{dep.ready}</span></span>
                  <span>Up-to-date: <span className="text-foreground">{dep.up_to_date}</span></span>
                  <span>Available: <span className="text-foreground">{dep.available}</span></span>
                  <span>Age: <span className="text-foreground">{dep.age}</span></span>
                </MetadataGrid>
              </ResourceCard>
            ))}
          </div>
        )}
      </ResourceTableWrapper>

      <ScaleDialog
        open={!!scaleTarget}
        onOpenChange={(open) => { if (!open) setScaleTarget(null); }}
        deploymentName={scaleTarget || ""}
        onDone={refresh}
      />
      <ResourcesDialog
        open={!!resourcesTarget}
        onOpenChange={(open) => { if (!open) setResourcesTarget(null); }}
        deploymentName={resourcesTarget || ""}
        onDone={refresh}
      />
    </>
  );
}
