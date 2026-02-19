import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, Bell } from "lucide-react";
import { useClusterStore } from "@/stores/clusterStore";
import { newrelicGetNamespaceMetrics, newrelicGetActiveAlerts } from "@/lib/tauri-commands";
import { MetricsSparkline } from "@/components/metrics/MetricsChart";
import type { PodMetrics, ActiveAlert } from "@/types/k8s";
import { Badge } from "@/components/ui/badge";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

type SortKey = "name" | "cpu" | "memory";

function formatCpu(cores: number): string {
  if (cores < 0.001) return `${(cores * 1_000_000).toFixed(0)}µ`;
  if (cores < 1) return `${(cores * 1000).toFixed(0)}m`;
  return `${cores.toFixed(2)}`;
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}Mi`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}Gi`;
}

export function ObservabilityView() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const [pods, setPods] = useState<PodMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [timeRange, setTimeRange] = useState(60);
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    if (!activeContext) return;
    try {
      const result = await newrelicGetActiveAlerts(activeContext);
      setAlerts(result.alerts);
    } catch {
      setAlerts([]);
    }
  }, [activeContext]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const fetchMetrics = useCallback(async () => {
    if (!activeContext || !activeNamespace) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const result = await newrelicGetNamespaceMetrics(activeContext, activeNamespace, timeRange);
      setPods(result.pods);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("not configured")) {
        setNotConfigured(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [activeContext, activeNamespace, timeRange]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...pods].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.pod_name.localeCompare(b.pod_name);
    else if (sortKey === "cpu") cmp = a.cpu_usage_cores - b.cpu_usage_cores;
    else cmp = a.memory_usage_bytes - b.memory_usage_bytes;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  const formatAlertAge = (openTime: number) => {
    if (!openTime) return "";
    const diffMs = Date.now() - openTime;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (notConfigured) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">New Relic not configured</p>
          <p className="mt-1 text-sm">
            Add your API Key and Account ID in Settings to view metrics.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="mr-1 h-3.5 w-3.5" />
            Open Settings
          </Button>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Observability</h2>
        <div className="flex items-center gap-1">
          {[15, 60, 360].map((mins) => (
            <Button
              key={mins}
              variant={timeRange === mins ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(mins)}
            >
              {mins < 60 ? `${mins}m` : `${mins / 60}h`}
            </Button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-red-400" />
            Active Alerts
            <Badge variant="destructive" className="ml-1 text-xs">
              {alerts.length}
            </Badge>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {alerts.map((alert, i) => (
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
                  {formatAlertAge(alert.open_time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && pods.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && pods.length === 0 && !notConfigured && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No metrics data available for this namespace.
        </div>
      )}

      {sorted.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Pod Name{sortIndicator("name")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("cpu")}
                >
                  CPU{sortIndicator("cpu")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("memory")}
                >
                  Memory{sortIndicator("memory")}
                </TableHead>
                <TableHead>CPU Trend</TableHead>
                <TableHead>Mem Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((pod) => (
                <TableRow key={pod.pod_name}>
                  <TableCell className="font-mono text-xs max-w-xs truncate">
                    {pod.pod_name}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCpu(pod.cpu_usage_cores)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMemory(pod.memory_usage_bytes)}
                  </TableCell>
                  <TableCell>
                    <MetricsSparkline
                      timeseries={pod.timeseries}
                      metric="cpu"
                    />
                  </TableCell>
                  <TableCell>
                    <MetricsSparkline
                      timeseries={pod.timeseries}
                      metric="memory"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
