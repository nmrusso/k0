import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useResources } from "@/hooks/useResources";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";
import { ResourceTableWrapper } from "./ResourceTableWrapper";
import { ResourceCard, MetadataGrid } from "@/components/molecules";
import { IconButton } from "@/components/atoms";
import { ChevronDown, ChevronRight, Trash2, ScrollText, List, Network } from "lucide-react";
import { deletePod } from "@/lib/tauri-commands";
import { usePanelStore } from "@/stores/panelStore";
import { cn } from "@/lib/utils";
import type { PodInfo } from "@/types/k8s";

function statusVariant(status: string) {
  if (status === "Running" || status === "Succeeded") return "success" as const;
  if (status === "Pending") return "warning" as const;
  if (status === "Failed" || status === "CrashLoopBackOff" || status === "Error")
    return "destructive" as const;
  return "secondary" as const;
}

interface PodGroup {
  key: string;
  kind: string;
  name: string;
  pods: PodInfo[];
}

const KIND_ORDER: Record<string, number> = {
  Deployment: 0,
  StatefulSet: 1,
  DaemonSet: 2,
  Job: 3,
  ReplicaSet: 4,
  "": 99, // Standalone
};

function kindBadgeVariant(kind: string) {
  if (kind === "Deployment") return "default" as const;
  if (kind === "StatefulSet") return "secondary" as const;
  if (kind === "DaemonSet") return "outline" as const;
  if (kind === "Job") return "secondary" as const;
  return "outline" as const;
}

function groupPods(pods: PodInfo[]): PodGroup[] {
  const groupMap = new Map<string, PodGroup>();

  for (const pod of pods) {
    const kind = pod.workload_kind || "";
    const name = pod.workload_name || "";
    const key = kind ? `${kind}/${name}` : "__standalone__";

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, kind, name, pods: [] });
    }
    groupMap.get(key)!.pods.push(pod);
  }

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    const orderA = KIND_ORDER[a.kind] ?? 50;
    const orderB = KIND_ORDER[b.kind] ?? 50;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return groups;
}

function PodRow({
  pod,
  onSelect,
  onOpenLogs,
  onDelete,
}: {
  pod: PodInfo;
  onSelect: () => void;
  onOpenLogs: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <TableRow className="cursor-pointer" onClick={onSelect}>
      <TableCell className="font-mono text-xs">{pod.name}</TableCell>
      <TableCell>{pod.ready}</TableCell>
      <TableCell>
        <Badge variant={statusVariant(pod.status)}>{pod.status}</Badge>
      </TableCell>
      <TableCell>{pod.restarts}</TableCell>
      <TableCell className="font-mono text-xs">{pod.ip}</TableCell>
      <TableCell className="text-xs">{pod.node}</TableCell>
      <TableCell>{pod.age}</TableCell>
      <TableCell>
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={onOpenLogs}
            title={`View logs for ${pod.name}`}
          >
            <ScrollText className="h-4 w-4" />
          </IconButton>
          <IconButton
            onClick={onDelete}
            variant="destructive"
            title={`Delete ${pod.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PodCard({
  pod,
  onSelect,
  onOpenLogs,
  onDelete,
}: {
  pod: PodInfo;
  onSelect: () => void;
  onOpenLogs: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <ResourceCard onClick={onSelect}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm font-medium">{pod.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={statusVariant(pod.status)}>{pod.status}</Badge>
          <IconButton
            onClick={onOpenLogs}
            title={`View logs for ${pod.name}`}
          >
            <ScrollText className="h-4 w-4" />
          </IconButton>
          <IconButton
            onClick={onDelete}
            variant="destructive"
            title={`Delete ${pod.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <MetadataGrid>
        <span>Ready: <span className="text-foreground">{pod.ready}</span></span>
        <span>Restarts: <span className="text-foreground">{pod.restarts}</span></span>
        <span>IP: <span className="font-mono text-foreground">{pod.ip}</span></span>
        <span>Age: <span className="text-foreground">{pod.age}</span></span>
        <span className="col-span-2 truncate">Node: <span className="text-foreground">{pod.node}</span></span>
      </MetadataGrid>
    </ResourceCard>
  );
}

export function PodTable() {
  const { data, loading, error, refresh } = useResources<PodInfo>();
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef } =
    useInfiniteScroll({ items: data });
  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const openLogTab = usePanelStore((s) => s.openLogTab);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [flatView, setFlatView] = useState(true);

  const groups = useMemo(() => groupPods(visibleItems), [visibleItems]);

  const handleDeletePod = (e: React.MouseEvent, podName: string) => {
    e.stopPropagation();
    deletePod(podName).catch(console.error);
  };

  const handleOpenLogs = (e: React.MouseEvent, podName: string) => {
    e.stopPropagation();
    openLogTab({
      targetKind: "pod",
      targetName: podName,
      title: podName,
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const flatToggle = (
    <div className="flex items-center rounded-md border border-border">
      <button
        onClick={() => setFlatView(false)}
        className={cn(
          "flex items-center rounded-l-md px-2 py-1 transition-colors",
          !flatView
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Grouped by workload"
      >
        <Network className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setFlatView(true)}
        className={cn(
          "flex items-center rounded-r-md px-2 py-1 transition-colors",
          flatView
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Flat list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <ResourceTableWrapper
      loading={loading}
      error={error}
      count={totalCount}
      visibleCount={visibleCount}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
      onRefresh={refresh}
      extraControls={flatToggle}
    >
      {flatView ? (
        // FLAT VIEW
        viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Restarts</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((pod) => (
                <PodRow
                  key={pod.name}
                  pod={pod}
                  onSelect={() => setSelectedPod(pod.name)}
                  onOpenLogs={(e) => handleOpenLogs(e, pod.name)}
                  onDelete={(e) => handleDeletePod(e, pod.name)}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((pod) => (
              <PodCard
                key={pod.name}
                pod={pod}
                onSelect={() => setSelectedPod(pod.name)}
                onOpenLogs={(e) => handleOpenLogs(e, pod.name)}
                onDelete={(e) => handleDeletePod(e, pod.name)}
              />
            ))}
          </div>
        )
      ) : (
        // GROUPED VIEW
        viewMode === "table" ? (
          <div className="space-y-2">
            {groups.map((group) => {
              const isCollapsed = !expandedGroups.has(group.key);
              const podCount = group.pods.length;
              const isStandalone = !group.kind;

              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                    {isStandalone ? (
                      <span className="text-muted-foreground">Standalone</span>
                    ) : (
                      <>
                        <Badge variant={kindBadgeVariant(group.kind)} className="text-[10px] px-1.5 py-0">
                          {group.kind}
                        </Badge>
                        <span className="font-mono text-xs text-foreground truncate">
                          {group.name}
                        </span>
                      </>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      ({podCount} {podCount === 1 ? "pod" : "pods"})
                    </span>
                  </button>
                  {!isCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Ready</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Restarts</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Node</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.pods.map((pod) => (
                          <PodRow
                            key={pod.name}
                            pod={pod}
                            onSelect={() => setSelectedPod(pod.name)}
                            onOpenLogs={(e) => handleOpenLogs(e, pod.name)}
                            onDelete={(e) => handleDeletePod(e, pod.name)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isCollapsed = !expandedGroups.has(group.key);
              const podCount = group.pods.length;
              const isStandalone = !group.kind;

              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors mb-2"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                    {isStandalone ? (
                      <span className="text-muted-foreground">Standalone</span>
                    ) : (
                      <>
                        <Badge variant={kindBadgeVariant(group.kind)} className="text-[10px] px-1.5 py-0">
                          {group.kind}
                        </Badge>
                        <span className="font-mono text-xs text-foreground truncate">
                          {group.name}
                        </span>
                      </>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      ({podCount} {podCount === 1 ? "pod" : "pods"})
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.pods.map((pod) => (
                        <PodCard
                          key={pod.name}
                          pod={pod}
                          onSelect={() => setSelectedPod(pod.name)}
                          onOpenLogs={(e) => handleOpenLogs(e, pod.name)}
                          onDelete={(e) => handleDeletePod(e, pod.name)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </ResourceTableWrapper>
  );
}
