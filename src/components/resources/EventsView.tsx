import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClusterStore } from "@/stores/clusterStore";
import { getNamespaceEvents } from "@/lib/tauri-commands";
import type { NamespaceEventInfo } from "@/types/k8s";
import { RefreshCw } from "lucide-react";

const TIME_RANGES = [
  { label: "30 minutes", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "3 hours", value: "180" },
  { label: "24 hours", value: "1440" },
  { label: "All", value: "all" },
];

export function EventsView() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const [events, setEvents] = useState<NamespaceEventInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState("60");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchEvents = useCallback(async () => {
    if (!activeContext || !activeNamespace) return;
    setLoading(true);
    setError(null);
    try {
      const sinceMinutes = timeRange === "all" ? undefined : Number(timeRange);
      const data = await getNamespaceEvents(sinceMinutes);
      setEvents(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeContext, activeNamespace, timeRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.involved_kind) set.add(e.involved_kind);
    }
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = events;
    if (eventTypeFilter !== "all") {
      result = result.filter((e) => e.event_type === eventTypeFilter);
    }
    if (kindFilter !== "all") {
      result = result.filter((e) => e.involved_kind === kindFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.involved_name.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, eventTypeFilter, kindFilter, search]);

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
        <h2 className="text-lg font-semibold">Events</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
          <Button variant="ghost" size="sm" onClick={fetchEvents} className="h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="Warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Kinds</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search name, message, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-[220px] text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No events found matching the current filters.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Type</TableHead>
              <TableHead className="w-24">Kind</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Reason</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-16 text-right">Count</TableHead>
              <TableHead className="w-20">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ev, i) => (
              <TableRow key={`${ev.involved_name}-${ev.reason}-${ev.timestamp}-${i}`}>
                <TableCell>
                  <Badge
                    variant={ev.event_type === "Warning" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {ev.event_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{ev.involved_kind}</TableCell>
                <TableCell className="text-xs font-medium">{ev.involved_name}</TableCell>
                <TableCell className="text-xs">{ev.reason}</TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                  {ev.message}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{ev.count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{ev.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
