import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  minikubeCheckInstalled,
  minikubeListProfiles,
  minikubeGetStatus,
  minikubeStartCluster,
  minikubeStopCluster,
  minikubeDeleteCluster,
  minikubeListAddons,
  minikubeToggleAddon,
  minikubeGetDashboardUrl,
  getContexts,
} from "@/lib/tauri-commands";
import type { MinikubeProfile, MinikubeStatus, MinikubeAddon } from "@/types/k8s";
import {
  RefreshCw,
  Play,
  Square,
  Trash2,
  Plus,
  ExternalLink,
  Loader2,
} from "lucide-react";

export function MinikubeView() {

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<MinikubeProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [status, setStatus] = useState<MinikubeStatus | null>(null);
  const [addons, setAddons] = useState<MinikubeAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [addonsLoading, setAddonsLoading] = useState(false);

  // Streaming output
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [operationRunning, setOperationRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("minikube");
  const [createCpus, setCreateCpus] = useState("2");
  const [createMemory, setCreateMemory] = useState("4096");
  const [createDriver, setCreateDriver] = useState("docker");
  const [createK8sVersion, setCreateK8sVersion] = useState("");

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Dashboard loading
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Addon toggling state
  const [togglingAddon, setTogglingAddon] = useState<string | null>(null);

  const checkInstalled = useCallback(async () => {
    const result = await minikubeCheckInstalled();
    setInstalled(result);
    return result;
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const data = await minikubeListProfiles();
      setProfiles(data);
      if (data.length > 0 && !data.find((p) => p.name === selectedProfile)) {
        setSelectedProfile(data[0].name);
      }
    } catch {
      setProfiles([]);
    }
  }, [selectedProfile]);

  const fetchStatus = useCallback(async (profile: string) => {
    if (!profile) return;
    setStatusLoading(true);
    try {
      const data = await minikubeGetStatus(profile);
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchAddons = useCallback(async (profile: string) => {
    if (!profile) return;
    setAddonsLoading(true);
    try {
      const data = await minikubeListAddons(profile);
      setAddons(data);
    } catch {
      setAddons([]);
    } finally {
      setAddonsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const ok = await checkInstalled();
    if (ok) {
      await fetchProfiles();
    }
    setLoading(false);
  }, [checkInstalled, fetchProfiles]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // When profile changes, fetch status + addons
  useEffect(() => {
    if (selectedProfile) {
      fetchStatus(selectedProfile);
      fetchAddons(selectedProfile);
    }
  }, [selectedProfile, fetchStatus, fetchAddons]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  const refreshContexts = useCallback(async () => {
    try {
      await getContexts();
    } catch {
      // ignore
    }
  }, []);

  const runStreamingOp = useCallback(
    async (
      opFn: (profile: string, sessionId: string) => Promise<void>,
      profile: string,
    ) => {
      const sessionId = `mk-${Date.now()}`;
      setOutputLines([]);
      setOperationRunning(true);

      const unlistenOutput = await listen<string>(
        `minikube-output-${sessionId}`,
        (event) => {
          setOutputLines((prev) => [...prev, event.payload]);
        },
      );
      const unlistenDone = await listen<boolean>(
        `minikube-done-${sessionId}`,
        async (event) => {
          setOperationRunning(false);
          setOutputLines((prev) => [
            ...prev,
            event.payload ? "\n--- Operation completed successfully ---" : "\n--- Operation failed ---",
          ]);
          unlistenOutput();
          unlistenDone();
          // Refresh after operation
          await fetchProfiles();
          if (selectedProfile) {
            await fetchStatus(selectedProfile);
          }
          await refreshContexts();
        },
      );

      try {
        await opFn(profile, sessionId);
      } catch (e) {
        setOutputLines((prev) => [...prev, `Error: ${e}`]);
        setOperationRunning(false);
        unlistenOutput();
        unlistenDone();
      }
    },
    [fetchProfiles, fetchStatus, selectedProfile, refreshContexts],
  );

  const handleStart = () => {
    if (!selectedProfile) return;
    runStreamingOp(
      (profile, sessionId) => minikubeStartCluster(profile, sessionId),
      selectedProfile,
    );
  };

  const handleStop = () => {
    if (!selectedProfile) return;
    runStreamingOp(minikubeStopCluster, selectedProfile);
  };

  const handleDelete = () => {
    if (!selectedProfile) return;
    setDeleteOpen(false);
    runStreamingOp(minikubeDeleteCluster, selectedProfile);
  };

  const handleCreate = () => {
    setCreateOpen(false);
    const name = createName || "minikube";
    runStreamingOp(
      (profile, sessionId) =>
        minikubeStartCluster(
          profile,
          sessionId,
          createCpus || undefined,
          createMemory || undefined,
          createDriver || undefined,
          createK8sVersion || undefined,
        ),
      name,
    );
    setSelectedProfile(name);
  };

  const handleDashboard = async () => {
    if (!selectedProfile) return;
    setDashboardLoading(true);
    try {
      const url = await minikubeGetDashboardUrl(selectedProfile);
      window.open(url, "_blank");
    } catch (e) {
      setOutputLines((prev) => [...prev, `Dashboard error: ${e}`]);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleToggleAddon = async (addonName: string, enable: boolean) => {
    if (!selectedProfile) return;
    setTogglingAddon(addonName);
    try {
      await minikubeToggleAddon(selectedProfile, addonName, enable);
      await fetchAddons(selectedProfile);
    } catch (e) {
      setOutputLines((prev) => [...prev, `Addon error: ${e}`]);
    } finally {
      setTogglingAddon(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (installed === false) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold mb-2">Minikube not found</p>
          <p className="text-sm mb-4">
            minikube is required to manage local Kubernetes clusters. Install it
            to get started.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                "https://minikube.sigs.k8s.io/docs/start/",
                "_blank",
              )
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Install minikube
          </Button>
        </div>
      </div>
    );
  }

  const currentProfile = profiles.find((p) => p.name === selectedProfile);
  const isRunning = status?.host === "Running";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Minikube</h2>
          {profiles.length > 0 && (
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAll}
            disabled={operationRunning}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStart}
            disabled={operationRunning || !selectedProfile}
            className="h-7"
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStop}
            disabled={operationRunning || !selectedProfile || !isRunning}
            className="h-7"
          >
            <Square className="mr-1 h-3.5 w-3.5" />
            Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={operationRunning || !selectedProfile}
            className="h-7 text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={operationRunning}
            className="h-7"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create
          </Button>
          {isRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDashboard}
              disabled={dashboardLoading}
              className="h-7"
            >
              {dashboardLoading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
              )}
              Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Status cards */}
      {selectedProfile && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatusCard
            label="Host"
            value={statusLoading ? "..." : (status?.host || "Unknown")}
            variant={status?.host === "Running" ? "success" : "warning"}
          />
          <StatusCard
            label="Kubelet"
            value={statusLoading ? "..." : (status?.kubelet || "Unknown")}
            variant={status?.kubelet === "Running" ? "success" : "warning"}
          />
          <StatusCard
            label="API Server"
            value={statusLoading ? "..." : (status?.apiserver || "Unknown")}
            variant={status?.apiserver === "Running" ? "success" : "warning"}
          />
          <StatusCard
            label="Kubeconfig"
            value={statusLoading ? "..." : (status?.kubeconfig || "Unknown")}
            variant={status?.kubeconfig === "Configured" ? "success" : "warning"}
          />
        </div>
      )}

      {/* Profile info */}
      {currentProfile && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <InfoCard label="Driver" value={currentProfile.driver} />
          <InfoCard label="K8s Version" value={currentProfile.kubernetes_version} />
          <InfoCard label="CPUs" value={String(currentProfile.cpus)} />
          <InfoCard label="Memory" value={`${currentProfile.memory} MB`} />
          <InfoCard label="IP" value={currentProfile.ip || "N/A"} />
        </div>
      )}

      {/* Output console */}
      {(operationRunning || outputLines.length > 0) && (
        <div className="rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Output
              {operationRunning && (
                <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
              )}
            </span>
            {!operationRunning && outputLines.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOutputLines([])}
                className="h-5 px-1 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
          <ScrollArea className="h-48">
            <div ref={outputRef} className="p-3 font-mono text-xs leading-relaxed">
              {outputLines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap text-muted-foreground">
                  {line}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Addons */}
      {selectedProfile && isRunning && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Addons</h3>
          {addonsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : addons.length === 0 ? (
            <div className="text-sm text-muted-foreground">No addons found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Addon</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addons.map((addon) => (
                  <TableRow key={addon.name}>
                    <TableCell className="text-sm">{addon.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={addon.enabled ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {addon.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={togglingAddon === addon.name}
                        onClick={() =>
                          handleToggleAddon(addon.name, !addon.enabled)
                        }
                      >
                        {togglingAddon === addon.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : addon.enabled ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Minikube Cluster</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Profile Name
              </label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="minikube"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  CPUs
                </label>
                <Input
                  value={createCpus}
                  onChange={(e) => setCreateCpus(e.target.value)}
                  placeholder="2"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Memory (MB)
                </label>
                <Input
                  value={createMemory}
                  onChange={(e) => setCreateMemory(e.target.value)}
                  placeholder="4096"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Driver
              </label>
              <Select value={createDriver} onValueChange={setCreateDriver}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docker">docker</SelectItem>
                  <SelectItem value="podman">podman</SelectItem>
                  <SelectItem value="kvm2">kvm2</SelectItem>
                  <SelectItem value="hyperkit">hyperkit</SelectItem>
                  <SelectItem value="virtualbox">virtualbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Kubernetes Version (optional)
              </label>
              <Input
                value={createK8sVersion}
                onChange={(e) => setCreateK8sVersion(e.target.value)}
                placeholder="e.g. v1.28.0"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the <strong>{selectedProfile}</strong>{" "}
            cluster? This action cannot be undone and will remove all data
            associated with this profile.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "success" | "warning";
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <Badge
        variant={variant === "success" ? "default" : "secondary"}
        className="mt-1 text-xs"
      >
        {value}
      </Badge>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
