import { useState, useEffect, useCallback, Fragment } from "react";
import {
  getIncidentSummary,
  getWhatChanged,
  getRolloutTimeline,
  newrelicGetActiveAlerts,
} from "@/lib/tauri-commands";
import type {
  IncidentSummary,
  ChangeEvent,
  RolloutTimeline,
  UnhealthyWorkload,
  ActiveAlert,
} from "@/types/k8s";
import { useClusterStore } from "@/stores/clusterStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Siren,
  RefreshCw,
  AlertTriangle,
  ArrowRightLeft,
  Activity,
  Globe,
  Clock,
  ImageIcon,
  RotateCcw,
  Scaling,
  Zap,
  Box,
  CheckCircle,
  Bell,
} from "lucide-react";
import { RolloutReplay } from "./RolloutReplay";
import { Skeleton } from "@/components/ui/skeleton";

const TIME_RANGES = [
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "180", label: "3 hours" },
] as const;

export function IncidentDashboard() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What Changed panel
  const [changeTimeRange, setChangeTimeRange] = useState("15");
  const [changes, setChanges] = useState<ChangeEvent[] | null>(null);
  const [changesLoading, setChangesLoading] = useState(false);

  // Rollout Replay sheet
  const [rolloutOpen, setRolloutOpen] = useState(false);
  const [rolloutTimeline, setRolloutTimeline] = useState<RolloutTimeline | null>(null);
  const [rolloutLoading, setRolloutLoading] = useState(false);

  // NR Active Alerts
  const [nrAlerts, setNrAlerts] = useState<ActiveAlert[]>([]);

  // Expanded states
  const [expandedWorkload, setExpandedWorkload] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!activeContext || !activeNamespace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getIncidentSummary();
      setSummary(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeContext, activeNamespace]);

  const fetchChanges = useCallback(async () => {
    if (!activeContext || !activeNamespace) return;
    setChangesLoading(true);
    try {
      const data = await getWhatChanged(parseInt(changeTimeRange));
      setChanges(data);
    } catch {
      setChanges([]);
    } finally {
      setChangesLoading(false);
    }
  }, [activeContext, activeNamespace, changeTimeRange]);

  const fetchNrAlerts = useCallback(async () => {
    if (!activeContext) return;
    try {
      const result = await newrelicGetActiveAlerts(activeContext);
      setNrAlerts(result.alerts);
    } catch {
      setNrAlerts([]);
    }
  }, [activeContext]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchSummary();
    fetchNrAlerts();
    const interval = setInterval(() => { fetchSummary(); fetchNrAlerts(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary, fetchNrAlerts]);

  // Fetch changes when time range changes
  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const handleOpenRollout = async (workload: UnhealthyWorkload) => {
    if (workload.kind !== "Deployment") return;
    setRolloutOpen(true);
    setRolloutLoading(true);
    try {
      const timeline = await getRolloutTimeline(workload.name);
      setRolloutTimeline(timeline);
    } catch {
      setRolloutTimeline(null);
    } finally {
      setRolloutLoading(false);
    }
  };

  if (!activeContext) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Select a cluster to get started</p>
      </div>
    );
  }

  if (!activeNamespace) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Siren className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p className="text-lg">Select a namespace</p>
          <p className="mt-1 text-sm">Incident Mode requires a namespace to analyze</p>
        </div>
      </div>
    );
  }

  const hasProblems = summary && (
    summary.unhealthy_workloads.length > 0 ||
    summary.error_events.length > 0 ||
    summary.affected_routes.length > 0
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Siren className="h-5 w-5 text-orange-400" />
        <h2 className="text-lg font-semibold">Incident Mode</h2>
        <Badge variant="outline" className="text-xs">{activeNamespace}</Badge>
        <button
          onClick={fetchSummary}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !summary && (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="col-span-2 h-32" />
        </div>
      )}

      {/* All clear state */}
      {!loading && summary && !hasProblems && (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <CheckCircle className="mb-3 h-16 w-16 text-green-400/60" />
          <p className="text-lg font-medium text-green-400">All clear!</p>
          <p className="mt-1 text-sm">No unhealthy workloads or warning events detected in {activeNamespace}</p>
        </div>
      )}

      {/* Dashboard grid */}
      {summary && hasProblems && (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* Top Offenders */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Top Offenders
                <Badge variant="secondary" className="ml-auto text-xs">
                  {summary.unhealthy_workloads.length}
                </Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {summary.unhealthy_workloads.map((wl) => (
                  <div
                    key={`${wl.kind}-${wl.name}`}
                    className="rounded-md border border-border/50 bg-background p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      if (wl.kind === "Deployment") {
                        handleOpenRollout(wl);
                      } else {
                        setExpandedWorkload(expandedWorkload === wl.name ? null : wl.name);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {wl.kind}
                      </Badge>
                      <span className="text-sm font-mono truncate">{wl.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Ready: <span className="text-red-400 font-semibold">{wl.ready}</span>
                      </span>
                    </div>
                    {wl.restart_count > 0 && (
                      <div className="mt-1 text-xs text-orange-400">
                        Restarts: {wl.restart_count}
                      </div>
                    )}
                    {wl.pod_errors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {wl.pod_errors.slice(0, 3).map((err, i) => (
                          <div key={i} className="text-xs text-red-400 font-mono truncate">{err}</div>
                        ))}
                        {wl.pod_errors.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{wl.pod_errors.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                    {expandedWorkload === wl.name && wl.events.length > 0 && (
                      <div className="mt-2 border-t border-border/50 pt-2 space-y-1">
                        {wl.events.map((ev, i) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            <span className={ev.event_type === "Warning" ? "text-yellow-400" : ""}>
                              {ev.reason}
                            </span>
                            : {ev.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* What Changed? */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ArrowRightLeft className="h-4 w-4 text-blue-400" />
                What Changed?
                <Select value={changeTimeRange} onValueChange={setChangeTimeRange}>
                  <SelectTrigger className="ml-auto h-6 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {changesLoading && <Skeleton className="h-20" />}
                {!changesLoading && changes && changes.length === 0 && (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No changes detected in the last {changeTimeRange} minutes
                  </div>
                )}
                {!changesLoading && changes?.map((change, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border/50 bg-background p-2"
                  >
                    <ChangeIcon changeType={change.change_type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {change.resource_kind}
                        </Badge>
                        <span className="text-xs font-mono truncate">{change.resource_name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {change.description}
                      </p>
                      {change.timestamp && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                          {formatTimestamp(change.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Events */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-yellow-400" />
                Warning Events
                <Badge variant="secondary" className="ml-auto text-xs">
                  {summary.error_events.length}
                </Badge>
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 pr-2 font-medium">Resource</th>
                      <th className="pb-1 pr-2 font-medium">Reason</th>
                      <th className="pb-1 pr-2 font-medium">Message</th>
                      <th className="pb-1 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.error_events.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground">
                          No warning events
                        </td>
                      </tr>
                    )}
                    {summary.error_events.slice(0, 20).map((ev, i) => {
                      const isExpanded = expandedEvent === `${ev.involved_name}-${i}`;
                      return (
                        <Fragment key={`${ev.involved_name}-${i}`}>
                          <tr
                            className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedEvent(isExpanded ? null : `${ev.involved_name}-${i}`)}
                          >
                            <td className="py-1 pr-2 font-mono">
                              <span className="text-muted-foreground">{ev.involved_kind}/</span>
                              {ev.involved_name}
                            </td>
                            <td className="py-1 pr-2">
                              <Badge variant="outline" className="text-[10px] text-yellow-400">
                                {ev.reason}
                              </Badge>
                            </td>
                            <td className="py-1 pr-2 max-w-[300px] truncate">{ev.message}</td>
                            <td className="py-1 text-right tabular-nums text-muted-foreground">
                              {ev.count > 1 ? `x${ev.count}` : ""}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={4} className="py-2 px-4">
                                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {ev.message}
                                </div>
                                <div className="mt-1 text-[10px] text-muted-foreground/60">
                                  Age: {ev.age} | Type: {ev.event_type}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Saturation */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-purple-400" />
                Saturation
                <Badge variant="secondary" className="ml-auto text-xs">
                  {summary.saturation.length}
                </Badge>
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 pr-2 font-medium">Workload</th>
                      <th className="pb-1 pr-2 font-medium">Ready</th>
                      <th className="pb-1 pr-2 font-medium">CPU Req</th>
                      <th className="pb-1 font-medium">Mem Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.saturation.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground">
                          No saturation issues
                        </td>
                      </tr>
                    )}
                    {summary.saturation.map((sat) => (
                      <Fragment key={sat.workload_name}>
                        <tr className="border-b border-border/30">
                          <td className="py-1 pr-2 font-mono">
                            <span className="text-muted-foreground">{sat.workload_kind}/</span>
                            {sat.workload_name}
                          </td>
                          <td className="py-1 pr-2">
                            <span className={sat.ready_replicas < sat.desired_replicas ? "text-red-400 font-semibold" : ""}>
                              {sat.ready_replicas}/{sat.desired_replicas}
                            </span>
                          </td>
                          <td className="py-1 pr-2 text-muted-foreground">
                            {sat.pods[0]?.requests_cpu || "-"}
                          </td>
                          <td className="py-1 text-muted-foreground">
                            {sat.pods[0]?.requests_memory || "-"}
                          </td>
                        </tr>
                        {sat.pods.filter(p => p.restarts > 0).map((pod) => (
                          <tr key={pod.name} className="text-muted-foreground/70">
                            <td className="py-0.5 pr-2 pl-4 font-mono text-[10px]">
                              <Box className="inline h-3 w-3 mr-1" />
                              {pod.name}
                            </td>
                            <td className="py-0.5 pr-2 text-[10px]">{pod.status}</td>
                            <td className="py-0.5 pr-2 text-[10px] text-orange-400">
                              restarts: {pod.restarts}
                            </td>
                            <td className="py-0.5 text-[10px]">
                              {pod.limits_cpu && `cpu: ${pod.limits_cpu}`}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NR Active Alerts */}
            {nrAlerts.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-card p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4 text-red-400" />
                  NR Active Alerts
                  <Badge variant="destructive" className="ml-auto text-xs">
                    {nrAlerts.length}
                  </Badge>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {nrAlerts.map((alert, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          alert.priority === "critical" ? "bg-red-500" : "bg-yellow-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{alert.condition_name}</span>
                        <span className="text-muted-foreground">
                          {" "}— {alert.policy_name}
                        </span>
                        {alert.target_name && (
                          <span className="text-muted-foreground"> on {alert.target_name}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground">
                        {alert.open_time ? formatAlertAge(alert.open_time) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Affected Routes */}
            {summary.affected_routes.length > 0 && (
              <div className="col-span-2 rounded-lg border border-border bg-card p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4 text-cyan-400" />
                  Affected Routes
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {summary.affected_routes.length}
                  </Badge>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 pr-3 font-medium">Type</th>
                      <th className="pb-1 pr-3 font-medium">Name</th>
                      <th className="pb-1 pr-3 font-medium">Hosts</th>
                      <th className="pb-1 pr-3 font-medium">Paths</th>
                      <th className="pb-1 pr-3 font-medium">Backend</th>
                      <th className="pb-1 font-medium">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.affected_routes.map((route, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1 pr-3">
                          <Badge variant="outline" className="text-[10px]">{route.route_type}</Badge>
                        </td>
                        <td className="py-1 pr-3 font-mono">{route.route_name}</td>
                        <td className="py-1 pr-3">{route.hosts.join(", ")}</td>
                        <td className="py-1 pr-3 font-mono">{route.paths.join(", ")}</td>
                        <td className="py-1 pr-3 font-mono">{route.backend_service}</td>
                        <td className="py-1">
                          <Badge
                            variant={route.backend_healthy ? "secondary" : "destructive"}
                            className="text-[10px]"
                          >
                            {route.backend_healthy ? "Healthy" : "Unhealthy"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rollout Replay Sheet */}
      <Sheet open={rolloutOpen} onOpenChange={setRolloutOpen}>
        <SheetContent>
          <RolloutReplay
            timeline={rolloutTimeline}
            loading={rolloutLoading}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatAlertAge(openTime: number): string {
  if (!openTime) return "";
  const diffMs = Date.now() - openTime;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ChangeIcon({ changeType }: { changeType: string }) {
  switch (changeType) {
    case "ImageUpdate":
      return <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />;
    case "Restart":
      return <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />;
    case "HPAScale":
      return <Scaling className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />;
    case "ScaleChange":
      return <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />;
    default:
      return <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString(undefined, {
      hour12: false,
      fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);
  } catch {
    return ts;
  }
}
