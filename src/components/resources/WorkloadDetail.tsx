import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { YamlEditorDialog } from "@/components/resources/YamlEditorDialog";
import { useClusterStore } from "@/stores/clusterStore";
import { getResourceDetail } from "@/lib/tauri-commands";
import { RESOURCE_COORDS_MAP } from "@/lib/resource-coords";
import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { ErrorAlert, SectionHeader } from "@/components/atoms";
import { DetailRow } from "@/components/molecules";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CollapsibleBadgeList } from "@/components/ui/collapsible-badge-list";
import type { GenericResourceDetailInfo } from "@/types/k8s";

// --- Type helpers ---
interface ContainerSpec {
  name: string;
  image: string;
  ports?: { containerPort: number; protocol?: string }[];
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  env?: { name: string; value?: string; valueFrom?: unknown }[];
  command?: string[];
  args?: string[];
}

function extractContainers(spec: unknown, resourceKind: string): ContainerSpec[] {
  if (!spec || typeof spec !== "object") return [];
  const s = spec as Record<string, unknown>;

  if (resourceKind === "cronjobs") {
    const jobTemplate = s["jobTemplate"] as Record<string, unknown> | undefined;
    const jobSpec = jobTemplate?.["spec"] as Record<string, unknown> | undefined;
    const tpl = jobSpec?.["template"] as Record<string, unknown> | undefined;
    const podSpec = tpl?.["spec"] as Record<string, unknown> | undefined;
    return (podSpec?.["containers"] as ContainerSpec[]) ?? [];
  }

  const template = s["template"] as Record<string, unknown> | undefined;
  const podSpec = template?.["spec"] as Record<string, unknown> | undefined;
  return (podSpec?.["containers"] as ContainerSpec[]) ?? [];
}

function extractStatus(status: unknown, resourceKind: string): [string, string][] {
  if (!status || typeof status !== "object") return [];
  const s = status as Record<string, unknown>;

  if (resourceKind === "statefulsets") {
    return [
      ["Ready Replicas", String(s["readyReplicas"] ?? "0")],
      ["Current Replicas", String(s["currentReplicas"] ?? "0")],
      ["Updated Replicas", String(s["updatedReplicas"] ?? "0")],
    ];
  }
  if (resourceKind === "daemonsets") {
    return [
      ["Desired", String(s["desiredNumberScheduled"] ?? "0")],
      ["Current", String(s["currentNumberScheduled"] ?? "0")],
      ["Ready", String(s["numberReady"] ?? "0")],
      ["Available", String(s["numberAvailable"] ?? "0")],
      ["Up to Date", String(s["updatedNumberScheduled"] ?? "0")],
    ];
  }
  if (resourceKind === "jobs") {
    return [
      ["Active", String(s["active"] ?? "0")],
      ["Succeeded", String(s["succeeded"] ?? "0")],
      ["Failed", String(s["failed"] ?? "0")],
      ["Start Time", String(s["startTime"] ?? "-")],
      ["Completion Time", String(s["completionTime"] ?? "-")],
    ];
  }
  if (resourceKind === "cronjobs") {
    const active = (s["active"] as unknown[] | undefined)?.length ?? 0;
    return [
      ["Active Jobs", String(active)],
      ["Last Schedule", String(s["lastScheduleTime"] ?? "-")],
    ];
  }
  return [];
}

function extractSpecFields(spec: unknown, resourceKind: string): [string, string][] {
  if (!spec || typeof spec !== "object") return [];
  const s = spec as Record<string, unknown>;

  if (resourceKind === "statefulsets") {
    return [
      ["Replicas", String(s["replicas"] ?? "1")],
      ["Service Name", String(s["serviceName"] ?? "-")],
      ["Pod Management", String(s["podManagementPolicy"] ?? "OrderedReady")],
      ["Update Strategy", String((s["updateStrategy"] as Record<string, unknown>)?.["type"] ?? "-")],
    ];
  }
  if (resourceKind === "daemonsets") {
    return [
      ["Update Strategy", String((s["updateStrategy"] as Record<string, unknown>)?.["type"] ?? "-")],
      ["Min Ready Seconds", String(s["minReadySeconds"] ?? "0")],
    ];
  }
  if (resourceKind === "jobs") {
    return [
      ["Completions", String(s["completions"] ?? "-")],
      ["Parallelism", String(s["parallelism"] ?? "1")],
      ["Backoff Limit", String(s["backoffLimit"] ?? "6")],
      ["TTL After Finished", String(s["ttlSecondsAfterFinished"] ?? "-")],
    ];
  }
  if (resourceKind === "cronjobs") {
    return [
      ["Schedule", String(s["schedule"] ?? "-")],
      ["Suspend", String(s["suspend"] ?? false)],
      ["Concurrency Policy", String(s["concurrencyPolicy"] ?? "Allow")],
      ["History Limit (Success)", String(s["successfulJobsHistoryLimit"] ?? "3")],
      ["History Limit (Failed)", String(s["failedJobsHistoryLimit"] ?? "1")],
    ];
  }
  return [];
}

// --- Containers section ---
function ContainersSection({ containers }: { containers: ContainerSpec[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(containers.map((c) => c.name)));

  return (
    <div className="space-y-2">
      {containers.map((c) => {
        const isExpanded = expanded.has(c.name);
        const ports = c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "-";
        const reqCpu = c.resources?.requests?.cpu || "-";
        const reqMem = c.resources?.requests?.memory || "-";
        const limCpu = c.resources?.limits?.cpu || "-";
        const limMem = c.resources?.limits?.memory || "-";

        return (
          <div key={c.name} className="rounded-md border border-border">
            <button
              onClick={() => setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(c.name)) next.delete(c.name); else next.add(c.name);
                return next;
              })}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-mono text-xs font-semibold">{c.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto font-mono">
                {c.image.split(":").pop() || "latest"}
              </Badge>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2">
                <DetailRow label="Image"><span className="font-mono text-xs break-all">{c.image}</span></DetailRow>
                <DetailRow label="Ports"><span className="font-mono text-xs">{ports}</span></DetailRow>
                <DetailRow label="CPU Request / Limit">
                  <span className="font-mono text-xs">{reqCpu} / {limCpu}</span>
                </DetailRow>
                <DetailRow label="Mem Request / Limit">
                  <span className="font-mono text-xs">{reqMem} / {limMem}</span>
                </DetailRow>
                {c.command && c.command.length > 0 && (
                  <DetailRow label="Command"><span className="font-mono text-xs">{c.command.join(" ")}</span></DetailRow>
                )}
                {c.args && c.args.length > 0 && (
                  <DetailRow label="Args"><span className="font-mono text-xs">{c.args.join(" ")}</span></DetailRow>
                )}
                {c.env && c.env.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 mt-1">Env ({c.env.length})</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {c.env.map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-muted-foreground shrink-0">{e.name}</span>
                          {e.value !== undefined && <span className="text-green-400 truncate">{e.value}</span>}
                          {!e.value && !!e.valueFrom && <span className="text-blue-400">(from ref)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Events section ---
function EventsSection({ events }: { events: { reason: string; message: string; count: number; age: string; event_type: string }[] }) {
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No events</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reason</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Count</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((ev, i) => (
          <TableRow key={i}>
            <TableCell>
              <Badge variant={ev.event_type === "Warning" ? "destructive" : "secondary"} className="text-xs">
                {ev.reason}
              </Badge>
            </TableCell>
            <TableCell className="text-xs max-w-xs truncate">{ev.message}</TableCell>
            <TableCell className="text-xs">{ev.count}</TableCell>
            <TableCell className="text-xs">{ev.age}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- Main component ---
export function WorkloadDetail() {
  const activeResource = useClusterStore((s) => s.activeResource);
  const selectedResourceName = useClusterStore((s) => s.selectedResourceName);
  const [detail, setDetail] = useState<GenericResourceDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const coords = RESOURCE_COORDS_MAP[activeResource as keyof typeof RESOURCE_COORDS_MAP];

  const fetchDetail = useCallback(async () => {
    if (!selectedResourceName || !coords) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getResourceDetail(coords, selectedResourceName);
      setDetail(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedResourceName, coords]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (!selectedResourceName || !coords) return null;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorAlert>{error}</ErrorAlert>
      </div>
    );
  }

  if (!detail) return null;

  const containers = extractContainers(detail.spec, activeResource);
  const statusFields = extractStatus(detail.status, activeResource);
  const specFields = extractSpecFields(detail.spec, activeResource);
  const labels = detail.labels || {};
  const annotations = detail.annotations || {};
  const events = detail.events || [];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{detail.name}</SheetTitle>
          <SheetDescription className="text-xs">
            {detail.namespace} · {coords.kind} · {detail.created}
          </SheetDescription>
          <div className="pt-1 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setYamlOpen(true)}
            >
              <FileCode className="h-3.5 w-3.5" />
              YAML
            </Button>
          </div>
        </SheetHeader>

        {/* Controlled by */}
        {detail.controlled_by && detail.controlled_by.length > 0 && (
          <div>
            <SectionHeader>Controlled By</SectionHeader>
            <div className="flex flex-wrap gap-1 mt-1">
              {detail.controlled_by.map((owner) => (
                <Badge key={owner.name} variant="outline" className="text-xs">
                  {owner.kind}/{owner.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Spec config */}
        {specFields.length > 0 && (
          <div>
            <SectionHeader>Configuration</SectionHeader>
            <div className="mt-1 space-y-1">
              {specFields.map(([k, v]) => (
                <DetailRow key={k} label={k}><span>{v}</span></DetailRow>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {statusFields.length > 0 && (
          <div>
            <SectionHeader>Status</SectionHeader>
            <div className="mt-1 space-y-1">
              {statusFields.map(([k, v]) => (
                <DetailRow key={k} label={k}><span>{v}</span></DetailRow>
              ))}
            </div>
          </div>
        )}

        {/* Containers */}
        {containers.length > 0 && (
          <div>
            <SectionHeader>Containers ({containers.length})</SectionHeader>
            <div className="mt-2">
              <ContainersSection containers={containers} />
            </div>
          </div>
        )}

        {/* Labels */}
        {Object.keys(labels).length > 0 && (
          <div>
            <SectionHeader>Labels</SectionHeader>
            <div className="mt-1">
              <CollapsibleBadgeList entries={labels} noun="label" />
            </div>
          </div>
        )}

        {/* Annotations */}
        {Object.keys(annotations).length > 0 && (
          <div>
            <SectionHeader>Annotations</SectionHeader>
            <div className="mt-1">
              <CollapsibleBadgeList entries={annotations} noun="annotation" />
            </div>
          </div>
        )}

        {/* Events */}
        <div>
          <SectionHeader>Events ({events.length})</SectionHeader>
          <div className="mt-2">
            <EventsSection events={events} />
          </div>
        </div>
      </div>

      {coords && selectedResourceName && (
        <YamlEditorDialog
          open={yamlOpen}
          onOpenChange={setYamlOpen}
          resourceCoords={coords}
          resourceName={selectedResourceName}
          onSaved={fetchDetail}
        />
      )}
    </ScrollArea>
  );
}
