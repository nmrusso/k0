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
import { usePanelStore } from "@/stores/panelStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { IconButton, SortableHead } from "@/components/atoms";
import {
  ScrollText,
  Scaling,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Minus,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  scaleDeployment,
  restartDeployment,
  getDeploymentInfo,
  updateDeploymentResources,
  getExternalSecretsForDeployment,
  forceSyncExternalSecret,
} from "@/lib/tauri-commands";
import { DEPLOYMENT_COORDS } from "@/lib/resource-coords";
import { useTableKeyboard } from "@/hooks/useTableKeyboard";
import { useChangedRows } from "@/hooks/useChangedRows";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useResourceTable } from "@/hooks/useResourceTable";
import { useResourceDelete } from "@/hooks/useResourceDelete";
import { useModalState } from "@/hooks/useModalState";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { cn } from "@/lib/utils";
import type { DeploymentInfo } from "@/types/k8s";

const depKey = (d: DeploymentInfo) => d.name;
const depHash = (d: DeploymentInfo) => `${d.ready}|${d.up_to_date}|${d.available}`;

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
          <DialogDescription className="font-mono text-xs">{deploymentName}</DialogDescription>
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
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setDesired(Math.max(0, desired - 1))}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input type="number" min={0} max={100} value={desired}
                  onChange={(e) => setDesired(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center" />
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setDesired(desired + 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
      await updateDeploymentResources(deploymentName, c.name, reqCpu, reqMem, limCpu, limMem);
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
          <DialogDescription className="font-mono text-xs">{deploymentName}</DialogDescription>
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
                  <Button key={c.name} variant={i === selectedIdx ? "default" : "outline"}
                    size="sm" onClick={() => selectContainer(i)} className="text-xs">
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
                <Input value={reqCpu} onChange={(e) => setReqCpu(e.target.value)} placeholder="100m" className="text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Requests Memory</label>
                <Input value={reqMem} onChange={(e) => setReqMem(e.target.value)} placeholder="128Mi" className="text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Limits CPU</label>
                <Input value={limCpu} onChange={(e) => setLimCpu(e.target.value)} placeholder="500m" className="text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Limits Memory</label>
                <Input value={limMem} onChange={(e) => setLimMem(e.target.value)} placeholder="256Mi" className="text-xs font-mono" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
  const { data, refresh, viewMode, setSelectedResourceName, getSortProps, visibleItems, wrapperProps } =
    useResourceTable<DeploymentInfo>();

  const openLogTab = usePanelStore((s) => s.openLogTab);
  const changedRows = useChangedRows(data, depKey, depHash);

  const { getRowProps } = useTableKeyboard<DeploymentInfo>({
    items: visibleItems,
    onSelect: (dep) => setSelectedResourceName(dep.name),
    onEscape: () => setSelectedResourceName(null),
    actions: {
      l: (dep) => openLogTab({ targetKind: "deployment", targetName: dep.name, title: `deploy/${dep.name}` }),
    },
  });

  const { selectedNames, toggleSelect, selectAll, clearSelection, isSelected, isAllSelected } =
    useMultiSelect(visibleItems);
  const [bulkRestartOpen, setBulkRestartOpen] = useState(false);

  const scale = useModalState<string>();
  const resources = useModalState<string>();
  const del = useResourceDelete(DEPLOYMENT_COORDS, refresh);

  const [restartingName, setRestartingName] = useState<string | null>(null);
  const [syncingName, setSyncingName] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleOpenLogs = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    openLogTab({ targetKind: "deployment", targetName: name, title: `deploy/${name}` });
  };

  const handleRestart = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setRestartingName(name);
    try {
      await restartDeployment(name);
      refresh();
    } finally {
      setRestartingName(null);
    }
  };

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
      <IconButton onClick={(e) => { e.stopPropagation(); scale.open(name); }} title="Scale">
        <Scaling className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={(e) => { e.stopPropagation(); resources.open(name); }} title="Edit resources">
        <SlidersHorizontal className="h-4 w-4" />
      </IconButton>
      <button onClick={(e) => handleRestart(e, name)}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Restart (rollout restart)" disabled={restartingName === name}>
        {restartingName === name
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <RotateCcw className="h-4 w-4" />}
      </button>
      <button onClick={(e) => handleSyncRestart(e, name)}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Sync secrets & restart" disabled={syncingName === name}>
        {syncingName === name
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <RefreshCcw className="h-4 w-4" />}
      </button>
      <IconButton onClick={(e) => handleOpenLogs(e, name)} title={`View logs for ${name}`}>
        <ScrollText className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={(e) => { e.stopPropagation(); del.open(name); }} variant="destructive" title={`Delete ${name}`}>
        <Trash2 className="h-4 w-4" />
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
      <ResourceTableWrapper {...wrapperProps} autoRefreshIntervalMs={30_000}>
        <BulkActionToolbar
          selectedCount={selectedNames.size}
          onClearSelection={clearSelection}
          actions={[{
            label: "Restart",
            icon: <RotateCcw className="mr-1 h-3.5 w-3.5" />,
            variant: "default",
            onClick: () => setBulkRestartOpen(true),
          }]}
        />
        <BulkConfirmDialog
          open={bulkRestartOpen}
          onOpenChange={setBulkRestartOpen}
          action="restart"
          resourceNames={Array.from(selectedNames)}
          onConfirm={async () => {
            await Promise.allSettled(Array.from(selectedNames).map((n) => restartDeployment(n)));
            clearSelection();
            refresh();
          }}
        />
        {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" checked={isAllSelected}
                    onChange={() => isAllSelected ? clearSelection() : selectAll()}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer" />
                </TableHead>
                <SortableHead label="Name" {...getSortProps("name")} />
                <SortableHead label="Ready" {...getSortProps("ready")} />
                <SortableHead label="Up-to-date" {...getSortProps("up_to_date")} />
                <SortableHead label="Available" {...getSortProps("available")} />
                <SortableHead label="Age" {...getSortProps("age")} />
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((dep, idx) => (
                <TableRow key={dep.name}
                  className={cn("cursor-pointer", getRowProps(idx).className, changedRows.has(dep.name) && "row-changed")}
                  onClick={() => setSelectedResourceName(dep.name)}>
                  <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected(dep.name)} onChange={() => {}}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(dep.name); }}
                      className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{dep.name}</TableCell>
                  <TableCell>{dep.ready}</TableCell>
                  <TableCell>{dep.up_to_date}</TableCell>
                  <TableCell>{dep.available}</TableCell>
                  <TableCell>{dep.age}</TableCell>
                  <TableCell><ActionButtons name={dep.name} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((dep) => (
              <ResourceCard key={dep.name} onClick={() => setSelectedResourceName(dep.name)}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{dep.name}</span>
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
        open={scale.isOpen}
        onOpenChange={scale.setOpen}
        deploymentName={scale.value ?? ""}
        onDone={refresh}
      />
      <ResourcesDialog
        open={resources.isOpen}
        onOpenChange={resources.setOpen}
        deploymentName={resources.value ?? ""}
        onDone={refresh}
      />
      <BulkConfirmDialog {...del.dialogProps} />
    </>
  );
}
