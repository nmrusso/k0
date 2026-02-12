import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { listen } from "@tauri-apps/api/event";
import { getPods, startLogStream, stopLogStream } from "@/lib/tauri-commands";
import { useLogParserConfig } from "@/hooks/useLogParserConfig";
import { parseLogLine, LOG_LEVEL_TEXT_COLORS, type LogLevel } from "@/lib/log-parser";
import { stripAnsi } from "@/lib/ansi";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, AlertCircle, ChevronDown, ChevronRight, Radio } from "lucide-react";
import type { PodInfo } from "@/types/k8s";

const MAX_ENTRIES = 2000;
const MAX_CONCURRENT_STREAMS = 20;
const ALL_DEPLOYMENTS = "__all__";

const TIME_RANGES = [
  { value: "5", label: "Last 5 min" },
  { value: "15", label: "Last 15 min" },
  { value: "30", label: "Last 30 min" },
  { value: "60", label: "Last 1 hour" },
  { value: "180", label: "Last 3 hours" },
  { value: "720", label: "Last 12 hours" },
  { value: "1440", label: "Last 24 hours" },
  { value: "0", label: "All time" },
] as const;

interface ErrorEntry {
  id: string;
  timestamp: string;
  epochMs: number;
  pod: string;
  deployment: string;
  level: LogLevel;
  message: string;
  raw: string;
}

function parseEpoch(ts: string | undefined): number {
  if (!ts) return Date.now();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

interface LogDataPayload {
  lines: string[];
}

export function ErrorsDashboard() {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deploymentFilter, setDeploymentFilter] = useState(ALL_DEPLOYMENTS);
  const [timeRangeMinutes, setTimeRangeMinutes] = useState("5");
  const [deployments, setDeployments] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [streamCount, setStreamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const parserConfig = useLogParserConfig();
  const activeSessionsRef = useRef<string[]>([]);
  const entryIdCounter = useRef(0);

  // Fetch deployment list once on mount
  useEffect(() => {
    getPods()
      .then((pods) => {
        const depSet = new Set<string>();
        for (const pod of pods) {
          if (pod.workload_name) depSet.add(pod.workload_name);
        }
        setDeployments(Array.from(depSet).sort());
      })
      .catch(() => {});
  }, []);

  // Restart streams when deployment or time range changes
  useEffect(() => {
    let cancelled = false;
    const unlisteners: (() => void)[] = [];

    // Clear previous state
    setEntries([]);
    setStreamCount(0);
    setLoading(true);

    // Stop existing sessions
    for (const sid of activeSessionsRef.current) {
      stopLogStream(sid).catch(() => {});
    }
    activeSessionsRef.current = [];

    const sinceSeconds = parseInt(timeRangeMinutes) * 60 || undefined;

    async function startStreams() {
      let pods: PodInfo[];
      try {
        pods = await getPods();
      } catch {
        if (!cancelled) setLoading(false);
        return;
      }

      if (cancelled) return;

      // Build pod → deployment map
      const podDeploymentMap = new Map<string, string>();
      for (const pod of pods) {
        podDeploymentMap.set(pod.name, pod.workload_name || pod.name);
      }

      // Filter pods: only running, and only matching deployment if selected
      let targetPods = pods.filter((p) => p.status === "Running");
      if (deploymentFilter !== ALL_DEPLOYMENTS) {
        targetPods = targetPods.filter(
          (p) => (p.workload_name || p.name) === deploymentFilter,
        );
      }
      targetPods = targetPods.slice(0, MAX_CONCURRENT_STREAMS);

      let started = 0;

      for (const pod of targetPods) {
        if (cancelled) break;

        const sessionId = `errors-${pod.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const deployment = podDeploymentMap.get(pod.name) || pod.name;

        try {
          const unlisten = await listen<LogDataPayload>(
            `log-data-${sessionId}`,
            (event) => {
              if (cancelled) return;
              const newEntries: ErrorEntry[] = [];
              for (const line of event.payload.lines) {
                const parsed = parseLogLine(line, parserConfig);
                if (parsed.level === "error" || parsed.level === "warn") {
                  const ts = parsed.timestamp || new Date().toISOString();
                  newEntries.push({
                    id: `${sessionId}-${entryIdCounter.current++}`,
                    timestamp: ts,
                    epochMs: parseEpoch(parsed.timestamp),
                    pod: pod.name,
                    deployment,
                    level: parsed.level,
                    message: parsed.message,
                    raw: line,
                  });
                }
              }
              if (newEntries.length > 0) {
                setEntries((prev) => {
                  const combined = [...prev, ...newEntries];
                  return combined.length > MAX_ENTRIES
                    ? combined.slice(combined.length - MAX_ENTRIES)
                    : combined;
                });
              }
            },
          );
          unlisteners.push(unlisten);

          await startLogStream(sessionId, "pod", pod.name, undefined, undefined, sinceSeconds);
          activeSessionsRef.current.push(sessionId);
          started++;
          if (!cancelled) setStreamCount(started);
        } catch {
          // Skip pods that fail to stream
        }
      }

      if (!cancelled) setLoading(false);
    }

    startStreams();

    return () => {
      cancelled = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
      for (const sid of activeSessionsRef.current) {
        stopLogStream(sid).catch(() => {});
      }
      activeSessionsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentFilter, timeRangeMinutes]);

  // Deduplicate + text search (deployment & time already handled by backend)
  const deduped = useMemo(() => {
    const query = searchQuery.toLowerCase();

    const filtered = query
      ? entries.filter(
          (e) =>
            e.pod.toLowerCase().includes(query) ||
            e.message.toLowerCase().includes(query),
        )
      : entries;

    const groups = new Map<string, { entry: ErrorEntry; count: number; pods: Set<string> }>();
    for (const entry of filtered) {
      const key = `${entry.level}:${stripAnsi(entry.message).trim()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
        existing.pods.add(entry.pod);
        if (entry.epochMs > existing.entry.epochMs) {
          existing.entry = entry;
        }
      } else {
        groups.set(key, { entry, count: 1, pods: new Set([entry.pod]) });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.entry.epochMs - a.entry.epochMs,
    );
  }, [entries, searchQuery]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <h2 className="text-lg font-semibold">Errors & Warnings</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          <Radio className="h-3 w-3 text-green-400" />
          Streaming from {streamCount} pods
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={deploymentFilter} onValueChange={setDeploymentFilter}>
          <SelectTrigger className="h-8 w-64 text-xs">
            <SelectValue placeholder="All deployments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPLOYMENTS}>All deployments</SelectItem>
            {deployments.map((dep) => (
              <SelectItem key={dep} value={dep}>
                {dep}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRangeMinutes} onValueChange={setTimeRangeMinutes}>
          <SelectTrigger className="h-8 w-40 text-xs">
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

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by pod or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Pod</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="w-16 px-3 py-2 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Starting log streams...
                </td>
              </tr>
            )}
            {!loading && deduped.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No errors or warnings detected yet
                </td>
              </tr>
            )}
            {deduped.map(({ entry, count, pods }) => {
              const isExpanded = expandedId === entry.id;
              const bgClass = entry.level === "error"
                ? "bg-red-500/5 hover:bg-red-500/10"
                : "bg-yellow-500/5 hover:bg-yellow-500/10";

              return (
                <Fragment key={entry.id}>
                  <tr
                    className={`cursor-pointer border-b border-border/50 transition-colors ${bgClass}`}
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <td className="px-2 py-1.5">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs max-w-[200px] truncate">
                      {count > 1 ? `${pods.size} pods` : entry.pod}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs font-semibold ${LOG_LEVEL_TEXT_COLORS[entry.level]}`}>
                        {entry.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs max-w-[500px] truncate">
                      {stripAnsi(entry.message)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">
                      {count > 1 ? `x${count}` : ""}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={bgClass}>
                      <td colSpan={6} className="px-6 py-3">
                        <div className="space-y-2 text-xs">
                          {count > 1 && (
                            <div>
                              <span className="font-medium text-muted-foreground">Pods: </span>
                              <span className="font-mono">{Array.from(pods).join(", ")}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-muted-foreground">Deployment: </span>
                            <span className="font-mono">{entry.deployment}</span>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Raw: </span>
                            <pre className="mt-1 overflow-x-auto rounded bg-black/20 p-2 font-mono text-foreground/80 whitespace-pre-wrap break-all">
                              {stripAnsi(entry.raw)}
                            </pre>
                          </div>
                          {tryParseJsonPreview(entry.raw)}
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
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
  } catch {
    return ts;
  }
}

function tryParseJsonPreview(raw: string): React.ReactNode {
  const plain = stripAnsi(raw).trim();
  if (!plain.startsWith("{")) return null;
  try {
    const obj = JSON.parse(plain);
    return (
      <div>
        <span className="font-medium text-muted-foreground">Parsed JSON: </span>
        <pre className="mt-1 overflow-x-auto rounded bg-black/20 p-2 font-mono text-foreground/80 whitespace-pre-wrap">
          {JSON.stringify(obj, null, 2)}
        </pre>
      </div>
    );
  } catch {
    return null;
  }
}
