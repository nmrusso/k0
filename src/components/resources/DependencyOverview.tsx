import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getDependencyGraph } from "@/lib/tauri-commands";
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClusterStore } from "@/stores/clusterStore";
import type { ResourceType, GraphNode as GNode, GraphEdge as GEdge } from "@/types/k8s";

// --- Types for grouped data ---
interface ChildItem {
  name: string;
  kind: string;
  status: string;
  children: ChildItem[];
}

interface WorkloadGroup {
  id: string;
  kind: string;
  name: string;
  status: string;
  children: ChildItem[];
}

// --- Build workload groups from flat graph data ---
function buildWorkloadGroups(
  nodes: GNode[],
  edges: GEdge[],
): WorkloadGroup[] {
  const nodeMap = new Map<string, GNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Build parent -> children map
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source)!.push(e.target);
    parentOf.set(e.target, e.source);
  }

  // Find roots: nodes with no parent
  const roots = nodes.filter((n) => !parentOf.has(n.id));

  function buildChildren(nodeId: string): ChildItem[] {
    const kids = childrenOf.get(nodeId) || [];
    return kids
      .map((cid) => {
        const cn = nodeMap.get(cid);
        if (!cn) return null;
        return {
          name: cn.label,
          kind: cn.node_type,
          status: cn.status,
          children: buildChildren(cid),
        };
      })
      .filter(Boolean) as ChildItem[];
  }

  return roots.map((r) => ({
    id: r.id,
    kind: r.node_type,
    name: r.label,
    status: r.status,
    children: buildChildren(r.id),
  }));
}

// --- Badge variant by kind ---
const KIND_COLORS: Record<string, string> = {
  Deployment: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  ReplicaSet: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  StatefulSet: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  DaemonSet: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Job: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CronJob: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Pod: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const BORDER_COLORS: Record<string, string> = {
  Deployment: "border-violet-500/50",
  StatefulSet: "border-cyan-500/50",
  DaemonSet: "border-pink-500/50",
  Job: "border-amber-500/50",
  CronJob: "border-orange-500/50",
  ReplicaSet: "border-blue-500/50",
  Pod: "border-emerald-500/50",
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "Running" || status === "Succeeded"
      ? "bg-emerald-400"
      : status === "Pending"
        ? "bg-amber-400"
        : status === "Failed" || status === "CrashLoopBackOff"
          ? "bg-red-400"
          : "bg-gray-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

// --- Collapsible child list ---
function ChildList({
  items,
  label,
  onNavigate,
}: {
  items: ChildItem[];
  label: string;
  onNavigate: (kind: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="flex w-full items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {items.length} {label}
      </button>
      {expanded && (
        <div className="ml-2 mt-0.5 space-y-0.5 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <div key={item.name}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(item.kind, item.name);
                }}
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-mono text-neutral-300 hover:bg-white/10 transition-colors truncate"
              >
                <StatusDot status={item.status} />
                <span className="truncate">{item.name}</span>
              </button>
              {item.children.length > 0 && (
                <div className="ml-3">
                  <ChildList
                    items={item.children}
                    label={item.children[0]?.kind === "Pod" ? "Pods" : "children"}
                    onNavigate={onNavigate}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Custom workload card node ---
function WorkloadCardNode({ data }: NodeProps) {
  const d = data as {
    kind: string;
    name: string;
    status: string;
    children: ChildItem[];
    onNavigate: (kind: string, name: string) => void;
  };
  const borderClass = BORDER_COLORS[d.kind] || "border-neutral-600";
  const kindClass = KIND_COLORS[d.kind] || "bg-neutral-500/20 text-neutral-400";

  // Group children by kind
  const childrenByKind = new Map<string, ChildItem[]>();
  for (const c of d.children) {
    if (!childrenByKind.has(c.kind)) childrenByKind.set(c.kind, []);
    childrenByKind.get(c.kind)!.push(c);
  }

  // Flatten: also count grandchildren (pods)
  let totalPods = 0;
  function countPods(items: ChildItem[]) {
    for (const i of items) {
      if (i.kind === "Pod") totalPods++;
      countPods(i.children);
    }
  }
  countPods(d.children);

  return (
    <div
      className={`rounded-lg border-2 ${borderClass} bg-neutral-900/95 backdrop-blur-sm px-3 py-2 min-w-[180px] max-w-[260px] shadow-lg`}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-500" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-semibold ${kindClass}`}
        >
          {d.kind}
        </span>
        {totalPods > 0 && (
          <span className="text-[10px] text-neutral-500 ml-auto">{totalPods} pods</span>
        )}
      </div>

      {/* Name */}
      <div className="font-mono text-xs text-neutral-100 truncate" title={d.name}>
        {d.name}
      </div>

      {/* Status if standalone pod */}
      {d.kind === "Pod" && d.status && (
        <div className="flex items-center gap-1 mt-0.5">
          <StatusDot status={d.status} />
          <span className="text-[10px] text-neutral-400">{d.status}</span>
        </div>
      )}

      {/* Children grouped by kind */}
      {Array.from(childrenByKind.entries()).map(([kind, items]) => (
        <ChildList
          key={kind}
          items={items}
          label={kind === "ReplicaSet" ? "ReplicaSets" : kind === "Pod" ? "Pods" : kind + "s"}
          onNavigate={d.onNavigate}
        />
      ))}
    </div>
  );
}

const nodeTypes = { workloadCard: WorkloadCardNode };

// --- Resource type map ---
const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  Deployment: "deployments",
  ReplicaSet: "replicasets",
  StatefulSet: "statefulsets",
  DaemonSet: "daemonsets",
  Job: "jobs",
  CronJob: "cronjobs",
  Pod: "pods",
};

// --- Main component ---
export function DependencyOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawNodes, setRawNodes] = useState<GNode[]>([]);
  const [rawEdges, setRawEdges] = useState<GEdge[]>([]);
  const setActiveResource = useClusterStore((s) => s.setActiveResource);
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDependencyGraph();
      setRawNodes(data.nodes);
      setRawEdges(data.edges);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleNavigate = useCallback(
    (kind: string, name: string) => {
      const rt = RESOURCE_TYPE_MAP[kind];
      if (!rt) return;
      setActiveResource(rt);
      if (rt === "pods") {
        setSelectedPod(name);
      } else {
        setSelectedResourceName(name);
      }
    },
    [setActiveResource, setSelectedPod, setSelectedResourceName],
  );

  const { nodes, edges } = useMemo(() => {
    const groups = buildWorkloadGroups(rawNodes, rawEdges);

    // Layout: arrange cards in a grid
    const cols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
    const xSpacing = 300;
    const ySpacing = 220;

    const flowNodes: Node[] = groups.map((g, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        id: g.id,
        type: "workloadCard",
        position: { x: col * xSpacing, y: row * ySpacing },
        data: {
          kind: g.kind,
          name: g.name,
          status: g.status,
          children: g.children,
          onNavigate: handleNavigate,
        },
      };
    });

    // Edges between top-level groups (e.g., CronJob -> Job)
    const groupIds = new Set(groups.map((g) => g.id));
    const flowEdges: Edge[] = rawEdges
      .filter((e) => groupIds.has(e.source) && groupIds.has(e.target))
      .map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
        style: { stroke: "#6b7280", strokeWidth: 1.5 },
      }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [rawNodes, rawEdges, handleNavigate]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchGraph}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No workloads found in this namespace</p>
        <Button variant="outline" size="sm" onClick={fetchGraph}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] w-full rounded-lg border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
        onNodeClick={(_, node) => {
          const d = node.data as { kind: string; name: string };
          handleNavigate(d.kind, d.name);
        }}
      >
        <Background color="#333" gap={20} />
        <Controls className="!bg-neutral-800 !border-neutral-700 [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-300 [&>button:hover]:!bg-neutral-700" />
      </ReactFlow>
    </div>
  );
}
