import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditableField } from "@/components/ui/editable-field";
import { YamlEditorDialog } from "@/components/resources/YamlEditorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClusterStore } from "@/stores/clusterStore";
import { usePanelStore } from "@/stores/panelStore";
import { getPodDetail, getSecretValue, getSecretData, patchResource, getImageHistory } from "@/lib/tauri-commands";
import { CollapsibleBadgeList } from "@/components/ui/collapsible-badge-list";
import { PortForwardDialog } from "@/components/portforward/PortForwardDialog";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  FileCode,
  History,
  Terminal,
  ScrollText,
  ArrowUpRight,
} from "lucide-react";
import { ErrorAlert, SectionHeader, IconButton, StatusDot } from "@/components/atoms";
import { DetailRow } from "@/components/molecules";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  PodDetailInfo,
  ProbeInfo,
  EnvVarInfo,
  MountInfo,
  VolumeInfo,
  TolerationInfo,
  ImageHistoryEntry,
} from "@/types/k8s";
import {
  POD_COORDS,
  DEPLOYMENT_COORDS,
  STATEFULSET_COORDS,
  DAEMONSET_COORDS,
} from "@/lib/resource-coords";
import type { ResourceCoordinates } from "@/lib/tauri-commands";

function getOwnerCoords(kind: string): ResourceCoordinates | null {
  switch (kind) {
    case "Deployment":
      return DEPLOYMENT_COORDS;
    case "StatefulSet":
      return STATEFULSET_COORDS;
    case "DaemonSet":
      return DAEMONSET_COORDS;
    default:
      return null;
  }
}

function ProbeDisplay({ probe }: { probe: ProbeInfo }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary">{probe.probe_type}</Badge>
      <Badge variant="secondary">{probe.details}</Badge>
      <Badge variant="secondary">delay={probe.delay}s</Badge>
      <Badge variant="secondary">timeout={probe.timeout}s</Badge>
      <Badge variant="secondary">period={probe.period}s</Badge>
      <Badge variant="secondary">
        #success={probe.success_threshold}
      </Badge>
      <Badge variant="secondary">
        #failure={probe.failure_threshold}
      </Badge>
    </div>
  );
}

function SecretEnvEntry({ env }: { env: EnvVarInfo }) {
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (value !== null) {
      setRevealed(true);
      return;
    }
    setLoading(true);
    try {
      const v = await getSecretValue(env.source_name, env.source_key);
      setValue(v);
      setRevealed(true);
    } catch (e) {
      setValue(`Error: ${e}`);
      setRevealed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-1.5 text-xs font-mono">
      <span className="text-primary shrink-0">{env.name}</span>
      <span className="text-muted-foreground">:</span>
      <span className="flex items-center gap-1">
        <span className="text-muted-foreground">
          secret({env.source_name}/{env.source_key})
        </span>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : revealed && value !== null ? (
          <span className="flex items-center gap-1">
            <span className="text-foreground break-all">{value}</span>
            <button
              onClick={handleReveal}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <button
            onClick={handleReveal}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}

function EnvFromSecretGroup({ sourceName }: { sourceName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [decoded, setDecoded] = useState<Record<string, boolean>>({});

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (data !== null) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    try {
      const d = await getSecretData(sourceName);
      setData(d);
      setExpanded(true);
    } catch (e) {
      setData({});
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleDecode = (key: string) => {
    setDecoded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <button
        onClick={handleExpand}
        className="flex items-center gap-1 text-xs font-mono hover:text-primary transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="text-muted-foreground">
          secret({sourceName}) — all keys
        </span>
      </button>
      {expanded && data && (
        <div className="mt-1 space-y-1.5 pl-5">
          {Object.entries(data).map(([k, v]) => {
            let decodedValue = "";
            try {
              decodedValue = atob(v);
            } catch {
              decodedValue = "(failed to decode)";
            }
            return (
              <div key={k}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-primary">{k}</span>
                  <button
                    onClick={() => toggleDecode(k)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={decoded[k] ? "Show base64" : "Decode base64"}
                  >
                    {decoded[k] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                <div className="mt-0.5 break-all font-mono text-xs text-green-400 pl-0">
                  {decoded[k] ? decodedValue : v}
                </div>
              </div>
            );
          })}
          {Object.keys(data).length === 0 && (
            <span className="text-xs text-muted-foreground">No data keys</span>
          )}
        </div>
      )}
    </div>
  );
}

function CollapsibleEnvVars({ envVars }: { envVars: EnvVarInfo[] }) {
  const [expanded, setExpanded] = useState(false);

  // Separate individual env vars from envFrom (all keys) entries
  const individualEnvs = envVars.filter((e) => !e.name.endsWith("(all keys)"));
  const envFromEntries = envVars.filter((e) => e.name.endsWith("(all keys)"));

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {envVars.length} Environment Variable{envVars.length !== 1 && "s"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-5">
          {individualEnvs.map((env, i) => {
            if (env.source === "secret" && env.source_key) {
              return <SecretEnvEntry key={i} env={env} />;
            }
            return (
              <div key={i} className="flex items-start gap-1.5 text-xs font-mono">
                <span className="text-primary shrink-0">{env.name}</span>
                <span className="text-muted-foreground">:</span>
                {env.source === "secret" ? (
                  <span className="text-muted-foreground">
                    secret({env.source_name})
                  </span>
                ) : env.source === "configMap" ? (
                  <span className="text-muted-foreground">
                    configMap({env.source_name}{env.source_key ? `/${env.source_key}` : ""})
                  </span>
                ) : env.source === "fieldRef" ? (
                  <span className="text-muted-foreground">fieldRef({env.value})</span>
                ) : env.source === "resourceFieldRef" ? (
                  <span className="text-muted-foreground">resourceFieldRef({env.value})</span>
                ) : (
                  <span className="text-foreground break-all">{env.value}</span>
                )}
              </div>
            );
          })}
          {envFromEntries.map((env, i) => (
            <EnvFromSecretGroup key={`envfrom-${i}`} sourceName={env.source_name} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleMounts({ mounts }: { mounts: MountInfo[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {mounts.length} Mount{mounts.length !== 1 && "s"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-5">
          {mounts.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-foreground">{m.mount_path}</span>
              <span className="text-muted-foreground">from</span>
              <span className="text-primary">{m.name}</span>
              {m.sub_path && (
                <span className="text-muted-foreground">subPath={m.sub_path}</span>
              )}
              {m.read_only && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">ro</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleTolerations({ tolerations }: { tolerations: TolerationInfo[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {tolerations.length} Toleration{tolerations.length !== 1 && "s"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-5">
          {tolerations.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
              {t.key ? (
                <>
                  <span className="text-primary">{t.key}</span>
                  <span className="text-muted-foreground">{t.operator === "Exists" ? "exists" : `= ${t.value}`}</span>
                  {t.effect && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{t.effect}</Badge>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {t.operator === "Exists" ? "match all" : t.operator}
                  {t.effect && ` (${t.effect})`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleVolumeSources({ volume }: { volume: VolumeInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="font-mono text-xs">{volume.name}</span>
        <span className="text-muted-foreground ml-1">({volume.source})</span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-5">
          {volume.sources.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
              <Badge variant="secondary" className="text-[10px] px-1 py-0">{s.source_type}</Badge>
              {s.name && <span className="text-primary">{s.name}</span>}
              {s.detail && <span className="text-muted-foreground">{s.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageHistoryDialog({
  open,
  onOpenChange,
  ownerKind,
  ownerName,
  containerName,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerKind: string;
  ownerName: string;
  containerName: string;
  onSelect: (image: string) => void;
}) {
  const [entries, setEntries] = useState<ImageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getImageHistory(ownerKind, ownerName, containerName)
      .then(setEntries)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, ownerKind, ownerName, containerName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Image History</DialogTitle>
          <DialogDescription>
            Revision history for container <span className="font-mono">{containerName}</span>
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <ErrorAlert>{error}</ErrorAlert>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No revision history found.</p>
        )}
        {!loading && !error && entries.length > 0 && (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rev</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.revision}>
                    <TableCell className="font-mono">{entry.revision}</TableCell>
                    <TableCell className="max-w-sm truncate font-mono text-xs">
                      {entry.image}
                    </TableCell>
                    <TableCell>{entry.age}</TableCell>
                    <TableCell>
                      {entry.current ? (
                        <Badge variant="secondary">current</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onSelect(entry.image);
                            onOpenChange(false);
                          }}
                        >
                          Rollback
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PodDetail() {
  const selectedPod = useClusterStore((s) => s.selectedPod);
  const [detail, setDetail] = useState<PodDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [historyContainer, setHistoryContainer] = useState<string | null>(null);
  const [pfOpen, setPfOpen] = useState(false);
  const [pfPort, setPfPort] = useState<number | undefined>();

  const fetchDetail = useCallback(async () => {
    if (!selectedPod) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPodDetail(selectedPod);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedPod]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleImageSave = async (containerName: string, newImage: string) => {
    if (!detail?.workload_owner) return;
    const coords = getOwnerCoords(detail.workload_owner.kind);
    if (!coords) return;
    await patchResource(coords, detail.workload_owner.name, {
      spec: {
        template: {
          spec: {
            containers: [{ name: containerName, image: newImage }],
          },
        },
      },
    });
    fetchDetail();
  };

  const openLogTab = usePanelStore((s) => s.openLogTab);
  const openShellTab = usePanelStore((s) => s.openShellTab);
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  if (!selectedPod) return null;

  const handleExecShell = (container: string) => {
    openShellTab({
      podName: selectedPod,
      containerName: container,
      context: activeContext || "",
      namespace: activeNamespace || "",
      title: `${selectedPod}/${container}`,
    });
  };

  const handleOpenLogs = (container?: string) => {
    openLogTab({
      targetKind: "pod",
      targetName: selectedPod,
      title: container ? `${selectedPod}/${container}` : selectedPod,
      container: container ?? null,
    });
  };

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 pr-8">
          <SheetTitle className="truncate font-mono">{selectedPod}</SheetTitle>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
              <FileCode className="h-3.5 w-3.5" />
              Edit YAML
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenLogs()}>
              <ScrollText className="h-3.5 w-3.5" />
              Logs
            </Button>
            {detail && detail.containers.length === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExecShell(detail.containers[0].name)}
              >
                <Terminal className="h-3.5 w-3.5" />
                Shell
              </Button>
            )}
          </div>
        </div>
        <SheetDescription>Pod details</SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {error && <ErrorAlert>{error}</ErrorAlert>}

          {detail && !loading && (
            <div className="space-y-6">
              {/* Properties */}
              <section>
                <SectionHeader>Properties</SectionHeader>
                <div className="rounded-lg border border-border">
                  <div className="px-4">
                    <DetailRow label="Created">{detail.created}</DetailRow>
                    <DetailRow label="Name">
                      <span className="font-mono">{detail.name}</span>
                    </DetailRow>
                    <DetailRow label="Namespace">
                      <span className="text-primary">{detail.namespace}</span>
                    </DetailRow>
                    <DetailRow label="Labels">
                      <CollapsibleBadgeList entries={detail.labels} noun="label" />
                    </DetailRow>
                    <DetailRow label="Annotations">
                      <CollapsibleBadgeList entries={detail.annotations} noun="annotation" />
                    </DetailRow>
                    <DetailRow label="Controlled By">
                      {detail.controlled_by.length > 0 ? (
                        detail.controlled_by.map((ref_) => (
                          <span key={ref_.name}>
                            {ref_.kind}{" "}
                            <span className="text-primary">{ref_.name}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Status">
                      <Badge
                        variant={
                          detail.status === "Running"
                            ? "success"
                            : detail.status === "Pending"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {detail.status}
                      </Badge>
                    </DetailRow>
                    <DetailRow label="Node">
                      <span className="text-primary">{detail.node}</span>
                    </DetailRow>
                    <DetailRow label="Pod IP">
                      <span className="font-mono">{detail.pod_ip}</span>
                    </DetailRow>
                    <DetailRow label="Pod IPs">
                      <div className="flex flex-wrap gap-1">
                        {detail.pod_ips.map((ip) => (
                          <Badge key={ip} variant="secondary" className="font-mono">
                            {ip}
                          </Badge>
                        ))}
                      </div>
                    </DetailRow>
                    <DetailRow label="Service Account">
                      <span className="text-primary">
                        {detail.service_account}
                      </span>
                    </DetailRow>
                    <DetailRow label="QoS Class">
                      {detail.qos_class}
                    </DetailRow>
                    <DetailRow label="Conditions">
                      {detail.conditions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {detail.conditions
                            .filter((c) => c.status === "True")
                            .map((c) => (
                              <Badge key={c.condition_type} variant="secondary">
                                {c.condition_type}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Tolerations">
                      {detail.tolerations.length > 0 ? (
                        <CollapsibleTolerations tolerations={detail.tolerations} />
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </DetailRow>
                  </div>
                </div>
              </section>

              {/* Volumes */}
              {detail.volumes.length > 0 && (
                <section>
                  <SectionHeader>Pod Volumes</SectionHeader>
                  <div className="rounded-lg border border-border">
                    <div className="px-4">
                      {detail.volumes.map((vol) => (
                        <DetailRow key={vol.name} label={vol.volume_type}>
                          {vol.sources && vol.sources.length > 0 ? (
                            <CollapsibleVolumeSources volume={vol} />
                          ) : (
                            <>
                              <span className="font-mono text-xs">{vol.name}</span>
                              {vol.source && (
                                <span className="ml-2 text-muted-foreground">
                                  ({vol.source})
                                </span>
                              )}
                            </>
                          )}
                        </DetailRow>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Containers */}
              <section>
                <SectionHeader>Containers</SectionHeader>
                <div className="space-y-4">
                  {detail.containers.map((container) => (
                    <div
                      key={container.name}
                      className="rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                        <div
                          className={`h-2 w-2 rounded-full ${container.ready ? "bg-success" : "bg-destructive"}`}
                        />
                        <span className="font-medium">{container.name}</span>
                        {detail.containers.length > 1 && (
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleOpenLogs(container.name)}
                              title={`View logs for ${container.name}`}
                            >
                              <ScrollText className="h-3.5 w-3.5" />
                              Logs
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleExecShell(container.name)}
                              title={`Open shell in ${container.name}`}
                            >
                              <Terminal className="h-3.5 w-3.5" />
                              Shell
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="px-4">
                        <DetailRow label="Status">
                          <span
                            className={
                              container.ready
                                ? "text-success"
                                : "text-destructive"
                            }
                          >
                            {container.status}
                          </span>
                        </DetailRow>
                        <DetailRow label="Image">
                          <div className="flex items-center gap-1.5">
                            {detail.workload_owner && getOwnerCoords(detail.workload_owner.kind) ? (
                              <>
                                <EditableField
                                  value={container.image}
                                  onSave={(v) => handleImageSave(container.name, v)}
                                  mono
                                  className="text-xs text-muted-foreground"
                                />
                                <IconButton
                                  onClick={() => setHistoryContainer(container.name)}
                                  title="Image history"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </IconButton>
                              </>
                            ) : (
                              <span className="break-all font-mono text-xs text-muted-foreground">
                                {container.image}
                              </span>
                            )}
                          </div>
                        </DetailRow>
                        {container.ports.length > 0 && (
                          <DetailRow label="Ports">
                            <div className="flex flex-wrap gap-1.5">
                              {container.ports.map((p) => {
                                const portNum = parseInt(p.split("/")[0], 10);
                                return (
                                  <span key={p} className="flex items-center gap-1">
                                    <span className="text-primary">{p}</span>
                                    {!isNaN(portNum) && (
                                      <button
                                        onClick={() => {
                                          setPfPort(portNum);
                                          setPfOpen(true);
                                        }}
                                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        title={`Forward port ${portNum}`}
                                      >
                                        <ArrowUpRight className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </DetailRow>
                        )}
                        <DetailRow label="Environment">
                          {container.env_vars.length > 0 ? (
                            <CollapsibleEnvVars envVars={container.env_vars} />
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </DetailRow>
                        <DetailRow label="Mounts">
                          {container.mounts.length > 0 ? (
                            <CollapsibleMounts mounts={container.mounts} />
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </DetailRow>
                        {container.liveness && (
                          <DetailRow label="Liveness">
                            <ProbeDisplay probe={container.liveness} />
                          </DetailRow>
                        )}
                        {container.readiness && (
                          <DetailRow label="Readiness">
                            <ProbeDisplay probe={container.readiness} />
                          </DetailRow>
                        )}
                        {container.command.length > 0 && (
                          <DetailRow label="Command">
                            <span className="break-all font-mono text-xs">
                              {container.command.join(" ")}{" "}
                              {container.args.join(" ")}
                            </span>
                          </DetailRow>
                        )}
                        {(container.requests_cpu || container.requests_memory) && (
                          <DetailRow label="Requests">
                            {[
                              container.requests_cpu &&
                                `CPU: ${container.requests_cpu}`,
                              container.requests_memory &&
                                `Memory: ${container.requests_memory}`,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </DetailRow>
                        )}
                        {(container.limits_cpu || container.limits_memory) && (
                          <DetailRow label="Limits">
                            {[
                              container.limits_cpu &&
                                `CPU: ${container.limits_cpu}`,
                              container.limits_memory &&
                                `Memory: ${container.limits_memory}`,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </DetailRow>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Events */}
              {detail.events.length > 0 && (
                <section>
                  <SectionHeader>Events</SectionHeader>
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Summary</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.events.map((ev, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                <StatusDot
                                  color={ev.event_type === "Warning" ? "warning" : "muted"}
                                  className="mt-1"
                                />
                                <span className="text-xs">
                                  {ev.reason}: {ev.message}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{ev.count}</TableCell>
                            <TableCell>{ev.age}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <YamlEditorDialog
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        resourceCoords={POD_COORDS}
        resourceName={selectedPod}
        onSaved={fetchDetail}
      />

      {detail?.workload_owner && historyContainer && (
        <ImageHistoryDialog
          open={!!historyContainer}
          onOpenChange={(open) => { if (!open) setHistoryContainer(null); }}
          ownerKind={detail.workload_owner.kind}
          ownerName={detail.workload_owner.name}
          containerName={historyContainer}
          onSelect={(image) => handleImageSave(historyContainer, image)}
        />
      )}

      <PortForwardDialog
        open={pfOpen}
        onOpenChange={setPfOpen}
        targetKind="pod"
        targetName={selectedPod}
        defaultPort={pfPort}
      />
    </>
  );
}
