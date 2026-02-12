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
import { getNetworkGraph } from "@/lib/tauri-commands";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphNode as GNode, GraphEdge as GEdge } from "@/types/k8s";

// --- Types ---
interface EndpointPod {
  name: string;
}

interface DeployChild {
  name: string;
  ready: string;
  podCount: number;
}

interface ServiceGroup {
  id: string;
  name: string;
  svcType: string;
  endpointCount: number;
  endpointPods: EndpointPod[];
  deployments: DeployChild[];
}

interface EntryPoint {
  id: string;
  name: string;
  entryType: "Ingress" | "Gateway";
  hosts: string;
  targetServices: string[];
  edgeLabels: Map<string, string>;
}

// --- Build grouped data from flat graph ---
function buildNetworkGroups(
  nodes: GNode[],
  edges: GEdge[],
): { services: ServiceGroup[]; entryPoints: EntryPoint[] } {
  const edgesFrom = new Map<string, { target: string; label: string }[]>();
  for (const e of edges) {
    if (!edgesFrom.has(e.source)) edgesFrom.set(e.source, []);
    edgesFrom.get(e.source)!.push({ target: e.target, label: e.label });
  }

  // Build service groups - parse status: "svcType|epCount|epPod1,epPod2,...|deployName:ready/desired:podCount;..."
  const services: ServiceGroup[] = nodes
    .filter((n) => n.node_type === "Service")
    .map((svc) => {
      const parts = svc.status.split("|");
      const svcType = parts[0] || "ClusterIP";
      const endpointCount = parseInt(parts[1]) || 0;
      const epPodsStr = parts[2] || "";
      const deploysStr = parts[3] || "";

      const endpointPods: EndpointPod[] = epPodsStr
        ? epPodsStr.split(",").filter(Boolean).map((name) => ({ name }))
        : [];

      const deployments: DeployChild[] = deploysStr
        ? deploysStr.split(";").filter(Boolean).map((entry) => {
            // format: "deployName:ready/desired|podCount"
            const [name, info] = entry.split(":");
            const [readyStr, podStr] = (info || "").split("|");
            return {
              name: name || "",
              ready: readyStr || "0/0",
              podCount: parseInt(podStr) || 0,
            };
          })
        : [];

      return {
        id: svc.id,
        name: svc.label,
        svcType,
        endpointCount,
        endpointPods,
        deployments,
      };
    });

  // Build entry points (ingresses + gateways)
  const entryPoints: EntryPoint[] = nodes
    .filter((n) => n.node_type === "Ingress" || n.node_type === "Gateway")
    .map((ep) => {
      const myEdges = edgesFrom.get(ep.id) || [];
      const targetServices = myEdges
        .filter((e) => e.target.startsWith("svc:"))
        .map((e) => e.target);
      const edgeLabels = new Map<string, string>();
      for (const e of myEdges) {
        if (e.label) edgeLabels.set(e.target, e.label);
      }
      return {
        id: ep.id,
        name: ep.label,
        entryType: ep.node_type as "Ingress" | "Gateway",
        hosts: ep.status,
        targetServices,
        edgeLabels,
      };
    });

  return { services, entryPoints };
}

// --- Status dot ---
function StatusDot({ ready }: { ready: string }) {
  const [r, d] = ready.split("/").map(Number);
  const color = r >= d ? "bg-emerald-400" : r > 0 ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

// --- Custom Entry Point node (Ingress / Gateway) ---
function EntryPointNode({ data }: NodeProps) {
  const d = data as { name: string; entryType: string; hosts: string };
  const isGateway = d.entryType === "Gateway";
  const borderColor = isGateway ? "border-purple-500/50" : "border-blue-500/50";
  const badgeBg = isGateway ? "bg-purple-500/20" : "bg-blue-500/20";
  const badgeBorder = isGateway ? "border-purple-500/30" : "border-blue-500/30";
  const badgeText = isGateway ? "text-purple-400" : "text-blue-400";

  return (
    <div className={`rounded-lg border-2 ${borderColor} bg-neutral-900/95 backdrop-blur-sm px-3 py-2 min-w-[180px] max-w-[260px] shadow-lg`}>
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-500" />
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-flex items-center rounded-md border ${badgeBorder} ${badgeBg} px-1.5 py-0 text-[10px] font-semibold ${badgeText}`}>
          {d.entryType}
        </span>
      </div>
      <div className="font-mono text-xs text-neutral-100 truncate" title={d.name}>
        {d.name}
      </div>
      {d.hosts && (
        <div className="text-[10px] text-neutral-400 truncate mt-0.5" title={d.hosts}>
          {d.hosts}
        </div>
      )}
    </div>
  );
}

// --- Custom Service node (with endpoints + deployments inside) ---
function ServiceCardNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    svcType: string;
    endpointCount: number;
    endpointPods: EndpointPod[];
    deployments: DeployChild[];
  };
  const [epExpanded, setEpExpanded] = useState(false);
  const [depExpanded, setDepExpanded] = useState(false);

  return (
    <div className="rounded-lg border-2 border-emerald-500/50 bg-neutral-900/95 backdrop-blur-sm px-3 py-2 min-w-[220px] max-w-[300px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-neutral-500" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0 text-[10px] font-semibold text-emerald-400">
          Service
        </span>
        <span className="text-[10px] text-neutral-500 ml-auto">{d.svcType}</span>
      </div>

      {/* Name */}
      <div className="font-mono text-xs text-neutral-100 truncate" title={d.name}>
        {d.name}
      </div>

      {/* Endpoints section */}
      <div className="mt-1.5 border-t border-neutral-700/50 pt-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEpExpanded(!epExpanded);
          }}
          className="flex w-full items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {epExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className={d.endpointCount > 0 ? "text-emerald-400" : "text-neutral-500"}>
            {d.endpointCount}
          </span>
          {" "}Endpoint{d.endpointCount !== 1 ? "s" : ""}
        </button>
        {epExpanded && d.endpointPods.length > 0 && (
          <div className="ml-2 mt-0.5 space-y-0.5 max-h-32 overflow-y-auto">
            {d.endpointPods.map((ep) => (
              <div
                key={ep.name}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-mono text-neutral-300 truncate"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="truncate">{ep.name}</span>
              </div>
            ))}
          </div>
        )}
        {epExpanded && d.endpointPods.length === 0 && (
          <div className="ml-5 text-[10px] text-neutral-500 italic">No endpoints</div>
        )}
      </div>

      {/* Deployments section */}
      {d.deployments.length > 0 && (
        <div className="mt-1 border-t border-neutral-700/50 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDepExpanded(!depExpanded);
            }}
            className="flex w-full items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {depExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {d.deployments.length} Deployment{d.deployments.length !== 1 ? "s" : ""}
          </button>
          {depExpanded && (
            <div className="ml-2 mt-0.5 space-y-1 max-h-40 overflow-y-auto">
              {d.deployments.map((dep) => (
                <div
                  key={dep.name}
                  className="rounded px-1.5 py-0.5 bg-neutral-800/50"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-200 truncate">
                    <StatusDot ready={dep.ready} />
                    <span className="truncate">{dep.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-3.5 text-[9px] text-neutral-500">
                    <span>Ready: {dep.ready}</span>
                    <span>Pods: {dep.podCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  entryPoint: EntryPointNode,
  serviceCard: ServiceCardNode,
};

// --- Main component ---
export function NetworkOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawNodes, setRawNodes] = useState<GNode[]>([]);
  const [rawEdges, setRawEdges] = useState<GEdge[]>([]);
  const [hiddenPaths, setHiddenPaths] = useState<Set<string>>(new Set());

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNetworkGraph();
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

  const { services, entryPoints } = useMemo(
    () => buildNetworkGroups(rawNodes, rawEdges),
    [rawNodes, rawEdges],
  );

  const togglePath = (entryId: string) => {
    setHiddenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const { nodes, edges } = useMemo(() => {
    const xSpacing = 320;
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Build a map of which entry points target each service
    const svcToEntryPoints = new Map<string, Set<string>>();
    for (const ep of entryPoints) {
      for (const svcId of ep.targetServices) {
        if (!svcToEntryPoints.has(svcId)) svcToEntryPoints.set(svcId, new Set());
        svcToEntryPoints.get(svcId)!.add(ep.id);
      }
    }

    // Determine which services to show:
    // A service is hidden if ALL its parent entry points are hidden
    const visibleEntries = entryPoints.filter((ep) => !hiddenPaths.has(ep.id));
    const hasEntryPoints = entryPoints.length > 0;

    const displayedServices = hasEntryPoints
      ? services.filter((svc) => {
          const parentEps = svcToEntryPoints.get(svc.id);
          if (!parentEps || parentEps.size === 0) {
            // Services not connected to any entry point: show only if no entry points are visible
            // or show always (orphan services)
            return visibleEntries.length === 0;
          }
          // Show if at least one parent entry point is visible
          return [...parentEps].some((epId) => !hiddenPaths.has(epId));
        })
      : services;

    // Row 0: Entry points (Ingresses + Gateways) — only visible ones
    const entryStartX = -(visibleEntries.length * xSpacing) / 2 + xSpacing / 2;
    for (let i = 0; i < visibleEntries.length; i++) {
      const ep = visibleEntries[i];
      flowNodes.push({
        id: ep.id,
        type: "entryPoint",
        position: { x: entryStartX + i * xSpacing, y: 0 },
        data: { name: ep.name, entryType: ep.entryType, hosts: ep.hosts },
      });
      // Edges to services (only displayed ones)
      const displayedSvcIds = new Set(displayedServices.map((s) => s.id));
      for (const svcId of ep.targetServices) {
        if (!displayedSvcIds.has(svcId)) continue;
        const portLabel = ep.edgeLabels.get(svcId) || "";
        flowEdges.push({
          id: `e-${ep.id}-${svcId}`,
          source: ep.id,
          target: svcId,
          label: portLabel || undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
          style: { stroke: "#6b7280", strokeWidth: 1.5 },
          labelStyle: { fill: "#a3a3a3", fontSize: 10 },
          labelBgStyle: { fill: "#171717", fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
        });
      }
    }

    // Row 1: Services
    const svcY = visibleEntries.length > 0 ? 180 : 0;
    const svcStartX = -(displayedServices.length * xSpacing) / 2 + xSpacing / 2;
    for (let i = 0; i < displayedServices.length; i++) {
      const svc = displayedServices[i];
      flowNodes.push({
        id: svc.id,
        type: "serviceCard",
        position: { x: svcStartX + i * xSpacing, y: svcY },
        data: {
          name: svc.name,
          svcType: svc.svcType,
          endpointCount: svc.endpointCount,
          endpointPods: svc.endpointPods,
          deployments: svc.deployments,
        },
      });
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [services, entryPoints, hiddenPaths]);

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

  if (rawNodes.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No network resources found in this namespace</p>
        <Button variant="outline" size="sm" onClick={fetchGraph}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] w-full gap-2">
      {/* Path toggle bar */}
      {entryPoints.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-xs text-muted-foreground">Paths:</span>
          {entryPoints.map((ep) => {
            const isHidden = hiddenPaths.has(ep.id);
            return (
              <Button
                key={ep.id}
                variant={isHidden ? "outline" : "default"}
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => togglePath(ep.id)}
              >
                {isHidden ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {ep.entryType === "Gateway" ? "GW" : "Ing"}/{ep.name}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs ml-auto"
            onClick={fetchGraph}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1 rounded-lg border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#333" gap={20} />
          <Controls className="!bg-neutral-800 !border-neutral-700 [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-300 [&>button:hover]:!bg-neutral-700" />
        </ReactFlow>
      </div>
    </div>
  );
}
