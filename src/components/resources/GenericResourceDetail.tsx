import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  getResourceDetail,
  getExternalSecretsForDeployment,
  restartDeployment,
  scaleDeployment,
  getDeploymentInfo,
  forceSyncExternalSecret,
} from "@/lib/tauri-commands";
import { CollapsibleBadgeList } from "@/components/ui/collapsible-badge-list";
import {
  ArrowLeft, FileCode, Eye, EyeOff, ChevronRight, ChevronDown, ExternalLink,
  RotateCcw, RefreshCcw, Scaling, ScrollText, Loader2, Minus, Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AskClaudeButton } from "@/components/resources/AskClaudeButton";
import {
  gatherDeploymentContext,
  gatherNetworkResourceContext,
  gatherGenericContext,
} from "@/lib/chat-context";
import { ErrorAlert, SectionHeader, IconButton, StatusDot } from "@/components/atoms";
import { DetailRow } from "@/components/molecules";
import type { GenericResourceDetailInfo } from "@/types/k8s";
import { RESOURCE_COORDS_MAP } from "@/lib/resource-coords";
import type { ResourceCoordinates } from "@/lib/tauri-commands";

function CollapsibleJson({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Collapse" : "Expand JSON"}
      </button>
      {open && (
        <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TruncatedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= 200) {
    return <span className="break-all whitespace-pre-wrap text-green-400">{text}</span>;
  }
  return (
    <span className="break-all whitespace-pre-wrap text-green-400">
      {expanded ? text : text.slice(0, 200) + "…"}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? "show less" : "show more"}
      </button>
    </span>
  );
}

function JsonValueDisplay({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">null</span>;
  }

  if (typeof value === "string") {
    return <TruncatedText text={value} />;
  }

  if (typeof value === "number") {
    return <span className="text-blue-400">{value}</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-yellow-400">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    // Array of simple values
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge key={i} variant="secondary" className="font-mono text-xs">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }
    // Array of objects — use `name` field as header when available
    return (
      <div className="space-y-2">
        {value.map((item, i) => {
          const label =
            item && typeof item === "object" && "name" in item && typeof (item as Record<string, unknown>).name === "string"
              ? (item as Record<string, unknown>).name as string
              : `[${i}]`;
          return (
            <div key={i} className="rounded border border-border/50 p-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {label}
              </div>
              <JsonValueDisplay value={item} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;

    if (depth > 5) {
      return <CollapsibleJson value={value} />;
    }

    return (
      <div className={depth > 0 ? "border-l-2 border-border/40 pl-3 space-y-0" : "space-y-0"}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex border-b border-border/30 py-1.5 last:border-0">
            <div className="w-36 shrink-0 text-xs text-muted-foreground">{k}</div>
            <div className="min-w-0 flex-1 text-xs">
              <JsonValueDisplay value={v} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function SecretDataEntry({ name, value }: { name: string; value: string }) {
  const [decoded, setDecoded] = useState(false);

  let decodedValue = "";
  try {
    decodedValue = atob(value);
  } catch {
    decodedValue = "(failed to decode)";
  }

  return (
    <div className="border-b border-border/30 py-2 last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-primary">{name}</span>
        <button
          onClick={() => setDecoded(!decoded)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title={decoded ? "Show base64" : "Decode base64"}
        >
          {decoded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
      <div className="mt-1 break-all font-mono text-xs text-green-400">
        {decoded ? decodedValue : value}
      </div>
    </div>
  );
}

function SecretDataDisplay({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span className="text-muted-foreground">No data</span>;
  }
  return (
    <div>
      {entries.map(([k, v]) => (
        <SecretDataEntry key={k} name={k} value={String(v ?? "")} />
      ))}
    </div>
  );
}

const RESOURCE_LABELS: Record<string, string> = {
  deployments: "Deployment",
  daemonsets: "DaemonSet",
  statefulsets: "StatefulSet",
  replicasets: "ReplicaSet",
  replicationcontrollers: "ReplicationController",
  jobs: "Job",
  cronjobs: "CronJob",
  services: "Service",
  configmaps: "ConfigMap",
  secrets: "Secret",
};

function ExternalSecretLink({ detail }: { detail: GenericResourceDetailInfo }) {
  const setActiveResource = useClusterStore((s) => s.setActiveResource);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  const secretName = (detail.spec as Record<string, unknown> | null)?.target
    ? ((detail.spec as Record<string, unknown>).target as Record<string, unknown>)?.name as string | undefined
    : undefined;
  const resolvedName = secretName || detail.name;

  return (
    <section>
      <SectionHeader>Generated Secret</SectionHeader>
      <div className="rounded-lg border border-border p-4">
        <button
          onClick={() => {
            setActiveResource("secrets");
            setSelectedResourceName(resolvedName);
          }}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {resolvedName}
        </button>
      </div>
    </section>
  );
}

function DeploymentExternalSecrets({ deploymentName }: { deploymentName: string }) {
  const setActiveResource = useClusterStore((s) => s.setActiveResource);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const [matches, setMatches] = useState<{ external_secret_name: string; secret_name: string; api_version: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getExternalSecretsForDeployment(deploymentName)
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [deploymentName]);

  if (loading || matches.length === 0) return null;

  return (
    <section>
      <SectionHeader>External Secrets</SectionHeader>
      <div className="rounded-lg border border-border p-4 space-y-2">
        {matches.map((m) => {
          // api_version is e.g. "external-secrets.io/v1beta1" → extract version part
          const version = m.api_version.split("/").pop() || "v1beta1";
          const crdResource = `crd:external-secrets.io/${version}/externalsecrets/Namespaced`;
          return (
            <div key={m.external_secret_name} className="flex items-center gap-3 text-sm">
              <button
                onClick={() => {
                  setActiveResource(crdResource);
                  setSelectedResourceName(m.external_secret_name);
                }}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {m.external_secret_name}
              </button>
              <span className="text-muted-foreground">→</span>
              <button
                onClick={() => {
                  setActiveResource("secrets");
                  setSelectedResourceName(m.secret_name);
                }}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                {m.secret_name}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeploymentActions({ name, onRefresh }: { name: string; onRefresh: () => void }) {
  const openLogTab = usePanelStore((s) => s.openLogTab);
  const [restarting, setRestarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [currentReplicas, setCurrentReplicas] = useState(0);
  const [desired, setDesired] = useState(0);
  const [scaleFetching, setScaleFetching] = useState(false);
  const [scaleLoading, setScaleLoading] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartDeployment(name);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setRestarting(false);
    }
  };

  const handleSyncRestart = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const matches = await getExternalSecretsForDeployment(name);
      if (matches.length === 0) {
        setSyncMsg("No ExternalSecrets found");
        return;
      }
      for (const m of matches) {
        await forceSyncExternalSecret(m.external_secret_name, name);
      }
      onRefresh();
    } catch (err) {
      setSyncMsg(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const openScale = () => {
    setScaleOpen(true);
    setScaleFetching(true);
    setScaleError(null);
    getDeploymentInfo(name)
      .then((info) => {
        setCurrentReplicas(info.replicas);
        setDesired(info.replicas);
      })
      .catch((e) => setScaleError(String(e)))
      .finally(() => setScaleFetching(false));
  };

  const handleScale = async () => {
    setScaleLoading(true);
    setScaleError(null);
    try {
      await scaleDeployment(name, desired);
      onRefresh();
      setScaleOpen(false);
    } catch (e) {
      setScaleError(String(e));
    } finally {
      setScaleLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <IconButton onClick={openScale} title="Scale">
          <Scaling className="h-4 w-4" />
        </IconButton>
        <button
          onClick={handleRestart}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Restart (rollout restart)"
          disabled={restarting}
        >
          {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        </button>
        <button
          onClick={handleSyncRestart}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Sync secrets & restart"
          disabled={syncing}
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </button>
        <IconButton
          onClick={() => openLogTab({ targetKind: "deployment", targetName: name, title: `deploy/${name}` })}
          title="View logs"
        >
          <ScrollText className="h-4 w-4" />
        </IconButton>
      </div>
      {syncMsg && (
        <span className="text-xs text-muted-foreground">{syncMsg}</span>
      )}

      <Dialog open={scaleOpen} onOpenChange={setScaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scale Deployment</DialogTitle>
            <DialogDescription className="font-mono text-xs">{name}</DialogDescription>
          </DialogHeader>
          {scaleFetching ? (
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
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDesired(Math.max(0, desired - 1))}>
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
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDesired(desired + 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {scaleError && <p className="text-sm text-destructive">{scaleError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setScaleOpen(false)}>Cancel</Button>
                <Button onClick={handleScale} disabled={scaleLoading}>
                  {scaleLoading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Scale
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GenericResourceDetail({ coords: coordsProp }: { coords?: ResourceCoordinates } = {}) {
  const selectedResourceName = useClusterStore((s) => s.selectedResourceName);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const activeResource = useClusterStore((s) => s.activeResource);
  const [detail, setDetail] = useState<GenericResourceDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const coords = useMemo(() => {
    if (coordsProp) return coordsProp;
    if (activeResource in RESOURCE_COORDS_MAP) return RESOURCE_COORDS_MAP[activeResource] as ResourceCoordinates;
    // Parse CRD resource type: "crd:group/version/plural/scope"
    const match = activeResource.match(/^crd:(.+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (match) return { group: match[1], version: match[2], kind: match[3], plural: match[3], clusterScoped: match[4] === "Cluster" };
    return undefined;
  }, [coordsProp?.group, coordsProp?.version, coordsProp?.kind, coordsProp?.plural, coordsProp?.clusterScoped, activeResource]);
  const kindLabel = coordsProp ? coordsProp.plural : (RESOURCE_LABELS[activeResource] || (coords?.plural ?? activeResource));

  const fetchDetail = useCallback(async () => {
    if (!selectedResourceName || !coords) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getResourceDetail(coords, selectedResourceName);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedResourceName, coords]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const isDeployment = activeResource === "deployments" || coords?.kind === "Deployment";

  const gatherContext = useCallback(async () => {
    if (!coords || !selectedResourceName) return "";
    const kind = coords.kind;
    if (["Deployment", "StatefulSet", "DaemonSet"].includes(kind)) {
      return gatherDeploymentContext(
        selectedResourceName,
        activeContext ?? "",
        activeNamespace ?? "",
        coords,
      );
    }
    if (["Service", "Ingress", "Gateway"].includes(kind)) {
      return gatherNetworkResourceContext(selectedResourceName, kind, coords);
    }
    return gatherGenericContext(selectedResourceName, kind, coords);
  }, [selectedResourceName, coords, activeContext, activeNamespace]);

  if (!selectedResourceName || !coords) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <IconButton onClick={() => setSelectedResourceName(null)}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <span className="text-sm font-semibold">{kindLabel}:</span>
        <span className="truncate font-mono text-sm">{selectedResourceName}</span>
        <div className="ml-auto flex items-center gap-1">
          {isDeployment && selectedResourceName && (
            <DeploymentActions name={selectedResourceName} onRefresh={fetchDetail} />
          )}
          <AskClaudeButton
            gatherContext={gatherContext}
            resourceKind={coords.kind}
            resourceName={selectedResourceName}
          />
          <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
            <FileCode className="h-3.5 w-3.5" />
            Edit YAML
          </Button>
        </div>
      </div>

      {/* Content */}
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
                    {detail.finalizers.length > 0 && (
                      <DetailRow label="Finalizers">
                        <div className="flex flex-wrap gap-1">
                          {detail.finalizers.map((f) => (
                            <Badge key={f} variant="secondary">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </DetailRow>
                    )}
                  </div>
                </div>
              </section>

              {/* Spec */}
              {detail.spec != null ? (
                <section>
                  <SectionHeader>Spec</SectionHeader>
                  <div className="rounded-lg border border-border p-4">
                    <JsonValueDisplay value={detail.spec} />
                  </div>
                </section>
              ) : null}

              {/* Status */}
              {detail.status != null ? (
                <section>
                  <SectionHeader>Status</SectionHeader>
                  <div className="rounded-lg border border-border p-4">
                    <JsonValueDisplay value={detail.status} />
                  </div>
                </section>
              ) : null}

              {/* Extra fields (e.g. "data" for ConfigMaps/Secrets) */}
              {Object.keys(detail.extra).length > 0 && (
                <section>
                  <SectionHeader>Data</SectionHeader>
                  {Object.entries(detail.extra).map(([key, val]) => (
                    <div key={key} className="mb-3">
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">{key}</h4>
                      <div className="rounded-lg border border-border p-4">
                        {activeResource === "secrets" && key === "data" && val && typeof val === "object" && !Array.isArray(val) ? (
                          <SecretDataDisplay data={val as Record<string, unknown>} />
                        ) : (
                          <JsonValueDisplay value={val} />
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* ExternalSecret → Secret link */}
              {coords?.plural?.includes("externalsecret") && detail && (
                <ExternalSecretLink detail={detail} />
              )}

              {/* Deployment → ExternalSecrets */}
              {coords?.kind === "Deployment" && selectedResourceName && (
                <DeploymentExternalSecrets deploymentName={selectedResourceName} />
              )}

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
        resourceCoords={coords}
        resourceName={selectedResourceName}
        onSaved={fetchDetail}
      />
    </div>
  );
}
