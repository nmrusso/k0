import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/stores/clusterStore";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { useTabStore } from "@/stores/tabStore";
import type { ResourceType } from "@/types/k8s";
import { getNamespaces, getCRDs, getConfig } from "@/lib/tauri-commands";
import { setActiveNamespace } from "@/lib/tauri-commands";
import type { NamespaceInfo, CRDInfo } from "@/types/k8s";
import {
  Star,
  X,
  Box,
  Rocket,
  Shield,
  Database,
  Repeat,
  Copy,
  Timer,
  Clock,
  Network,
  Workflow,
  Globe,
  DoorOpen,
  FileText,
  Lock,
  Layers,
  ChevronDown,
  ChevronRight,
  Puzzle,
  Gauge,
  SlidersHorizontal,
  Activity,
  TrendingUp,
  ShieldAlert,
  Crown,
  Container,
  Handshake,
  Webhook,
  CircleDot,
  Tag,
  ShieldCheck,
  HardDrive,
  FolderOpen,
  Archive,
  User,
  Key,
  KeyRound,
  Link,
  AlertCircle,
  Siren,
  Package,
  Bell,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResourceItem {
  type: ResourceType;
  label: string;
  icon: React.ReactNode;
  category: string;
}

const resources: ResourceItem[] = [
  // Workloads
  { type: "pods", label: "Pods", icon: <Box className="h-4 w-4" />, category: "Workloads" },
  { type: "deployments", label: "Deployments", icon: <Rocket className="h-4 w-4" />, category: "Workloads" },
  { type: "daemonsets", label: "DaemonSets", icon: <Shield className="h-4 w-4" />, category: "Workloads" },
  { type: "statefulsets", label: "StatefulSets", icon: <Database className="h-4 w-4" />, category: "Workloads" },
  { type: "replicasets", label: "ReplicaSets", icon: <Copy className="h-4 w-4" />, category: "Workloads" },
  { type: "replicationcontrollers", label: "ReplicationControllers", icon: <Repeat className="h-4 w-4" />, category: "Workloads" },
  { type: "jobs", label: "Jobs", icon: <Timer className="h-4 w-4" />, category: "Workloads" },
  { type: "cronjobs", label: "CronJobs", icon: <Clock className="h-4 w-4" />, category: "Workloads" },
  // Network
  { type: "network-overview", label: "Overview", icon: <Workflow className="h-4 w-4" />, category: "Network" },
  { type: "services", label: "Services", icon: <Network className="h-4 w-4" />, category: "Network" },
  { type: "ingresses", label: "Ingresses", icon: <Globe className="h-4 w-4" />, category: "Network" },
  { type: "gateways", label: "Gateways", icon: <DoorOpen className="h-4 w-4" />, category: "Network" },
  { type: "endpoints", label: "Endpoints", icon: <CircleDot className="h-4 w-4" />, category: "Network" },
  { type: "ingressclasses", label: "IngressClasses", icon: <Tag className="h-4 w-4" />, category: "Network" },
  { type: "networkpolicies", label: "NetworkPolicies", icon: <ShieldCheck className="h-4 w-4" />, category: "Network" },
  // Config
  { type: "configmaps", label: "ConfigMaps", icon: <FileText className="h-4 w-4" />, category: "Config" },
  { type: "secrets", label: "Secrets", icon: <Lock className="h-4 w-4" />, category: "Config" },
  { type: "resourcequotas", label: "ResourceQuotas", icon: <Gauge className="h-4 w-4" />, category: "Config" },
  { type: "limitranges", label: "LimitRanges", icon: <SlidersHorizontal className="h-4 w-4" />, category: "Config" },
  { type: "horizontalpodautoscalers", label: "HPA", icon: <Activity className="h-4 w-4" />, category: "Config" },
  { type: "verticalpodautoscalers", label: "VPA", icon: <TrendingUp className="h-4 w-4" />, category: "Config" },
  { type: "poddisruptionbudgets", label: "PodDisruptionBudgets", icon: <ShieldAlert className="h-4 w-4" />, category: "Config" },
  { type: "priorityclasses", label: "PriorityClasses", icon: <Crown className="h-4 w-4" />, category: "Config" },
  { type: "runtimeclasses", label: "RuntimeClasses", icon: <Container className="h-4 w-4" />, category: "Config" },
  { type: "leases", label: "Leases", icon: <Handshake className="h-4 w-4" />, category: "Config" },
  { type: "mutatingwebhookconfigurations", label: "MutatingWebhooks", icon: <Webhook className="h-4 w-4" />, category: "Config" },
  { type: "validatingwebhookconfigurations", label: "ValidatingWebhooks", icon: <Webhook className="h-4 w-4" />, category: "Config" },
  // Storage
  { type: "persistentvolumeclaims", label: "PVCs", icon: <FolderOpen className="h-4 w-4" />, category: "Storage" },
  { type: "persistentvolumes", label: "PVs", icon: <HardDrive className="h-4 w-4" />, category: "Storage" },
  { type: "storageclasses", label: "StorageClasses", icon: <Archive className="h-4 w-4" />, category: "Storage" },
  // Access Control
  { type: "serviceaccounts", label: "ServiceAccounts", icon: <User className="h-4 w-4" />, category: "Access Control" },
  { type: "roles", label: "Roles", icon: <Key className="h-4 w-4" />, category: "Access Control" },
  { type: "clusterroles", label: "ClusterRoles", icon: <KeyRound className="h-4 w-4" />, category: "Access Control" },
  { type: "rolebindings", label: "RoleBindings", icon: <Link className="h-4 w-4" />, category: "Access Control" },
  { type: "clusterrolebindings", label: "ClusterRoleBindings", icon: <Link className="h-4 w-4" />, category: "Access Control" },
];

// Cache CRDs per context to avoid re-fetching
const crdCache = new Map<string, CRDInfo[]>();

function CRDGroupItem({
  group,
  crds,
  activeResource,
  onSelect,
}: {
  group: string;
  crds: CRDInfo[];
  activeResource: string;
  onSelect: (crd: CRDInfo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasActive = crds.some(
    (crd) => activeResource === `crd:${crd.group}/${crd.version}/${crd.plural}/${crd.scope}`,
  );

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
          hasActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{group}</span>
      </button>
      {expanded && (
        <div className="pl-3">
          {crds.map((crd) => {
            const crdResource = `crd:${crd.group}/${crd.version}/${crd.plural}/${crd.scope}`;
            return (
              <button
                key={crd.name}
                onClick={() => onSelect(crd)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                  activeResource === crdResource
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Puzzle className="h-3 w-3 shrink-0" />
                <span className="truncate">{crd.kind}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const activeResource = useClusterStore((s) => s.activeResource);
  const openTab = useTabStore((s) => s.openTab);
  const setStoreNamespace = useClusterStore((s) => s.setActiveNamespace);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);
  const favorites = useFavoritesStore((s) => s.favorites);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const [nsExpanded, setNsExpanded] = useState(false);
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [nsLoading, setNsLoading] = useState(false);

  const [crdExpanded, setCrdExpanded] = useState(false);
  const [crds, setCrds] = useState<CRDInfo[]>([]);
  const [crdLoading, setCrdLoading] = useState(false);

  // Fetch namespaces when expanded
  useEffect(() => {
    if (!nsExpanded || !activeContext) return;
    setNsLoading(true);
    getNamespaces()
      .then(setNamespaces)
      .catch(() => setNamespaces([]))
      .finally(() => setNsLoading(false));
  }, [nsExpanded, activeContext]);

  // Fetch CRDs when expanded (with cache)
  useEffect(() => {
    if (!crdExpanded || !activeContext) return;
    const cached = crdCache.get(activeContext);
    if (cached) {
      setCrds(cached);
      return;
    }
    setCrdLoading(true);
    getCRDs()
      .then((result) => {
        crdCache.set(activeContext, result);
        setCrds(result);
      })
      .catch(() => setCrds([]))
      .finally(() => setCrdLoading(false));
  }, [crdExpanded, activeContext]);

  // Group CRDs by API group
  const crdGroups = useMemo(() => {
    const groups = new Map<string, CRDInfo[]>();
    for (const crd of crds) {
      const existing = groups.get(crd.group) || [];
      existing.push(crd);
      groups.set(crd.group, existing);
    }
    // Sort groups alphabetically
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [crds]);

  const handleSelectNamespace = async (name: string) => {
    try {
      await setActiveNamespace(name);
      setStoreNamespace(name);
    } catch {
      // ignore
    }
  };

  const handleSelectCRD = (crd: CRDInfo) => {
    openTab(`crd:${crd.group}/${crd.version}/${crd.plural}/${crd.scope}` as ResourceType);
    setSelectedResourceName(null);
  };

  const contextFavorites = useMemo(
    () => favorites.filter((f) => f.context === activeContext),
    [favorites, activeContext],
  );

  const categories = [...new Set(resources.map((r) => r.category))];

  // Track which categories are expanded (collapsed by default, or from settings)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Load default expanded categories from settings on mount
  useEffect(() => {
    if (defaultsLoaded) return;
    getConfig("sidebar_default_expanded")
      .then((val) => {
        if (val) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr) && arr.length > 0) {
              setExpandedCategories(new Set(arr));
              if (arr.includes("Namespaces")) setNsExpanded(true);
              if (arr.includes("Custom Resources")) setCrdExpanded(true);
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setDefaultsLoaded(true));
  }, [defaultsLoaded]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Auto-expand the category that contains the active resource
  useEffect(() => {
    const activeCat = resources.find((r) => r.type === activeResource)?.category;
    if (activeCat && !expandedCategories.has(activeCat)) {
      setExpandedCategories((prev) => new Set(prev).add(activeCat));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResource]);

  return (
    <div className="flex w-52 flex-col border-r border-sidebar-border bg-sidebar-background">
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Namespaces section */}
          {activeContext && (
            <div className="mb-3">
              <button
                onClick={() => setNsExpanded(!nsExpanded)}
                className="mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {nsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Namespaces
              </button>
              {nsExpanded && (
                <div className="max-h-48 overflow-y-auto">
                  {nsLoading ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
                  ) : (
                    namespaces.map((ns) => (
                      <button
                        key={ns.name}
                        onClick={() => handleSelectNamespace(ns.name)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                          activeNamespace === ns.name
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ns.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pinned / Favorites section */}
          {activeContext && contextFavorites.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-400/80">
                <Star className="h-3 w-3 fill-current" />
                Pinned
              </div>
              {contextFavorites.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => {
                    openTab(fav.resourceType);
                    if (fav.resourceType === "pods") setSelectedPod(fav.name);
                    else if (fav.resourceType === "ingresses") setSelectedIngress(fav.name);
                    else if (fav.resourceType === "gateways") setSelectedGateway(fav.name);
                    else setSelectedResourceName(fav.name);
                  }}
                  className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
                >
                  <span className="truncate flex-1 text-left">{fav.label}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(fav.id);
                    }}
                    className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Overview button */}
          {activeContext && activeNamespace && (
            <div className="mb-3">
              <button
                onClick={() => openTab("overview" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "overview"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Workflow className="h-4 w-4" />
                Overview
              </button>
            </div>
          )}

          {/* Errors button */}
          {activeContext && (
            <div className="mb-3">
              <button
                onClick={() => openTab("log-errors" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "log-errors"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <AlertCircle className="h-4 w-4 text-red-400" />
                Errors
              </button>
            </div>
          )}

          {/* Incident Mode button */}
          {activeContext && (
            <div className="mb-3">
              <button
                onClick={() => openTab("incident-mode" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "incident-mode"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Siren className="h-4 w-4 text-orange-400" />
                Incident Mode
              </button>
            </div>
          )}

          {/* Helm Releases button */}
          {activeContext && activeNamespace && (
            <div className="mb-3">
              <button
                onClick={() => openTab("helm-releases" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "helm-releases"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Package className="h-4 w-4" />
                Helm Releases
              </button>
            </div>
          )}

          {/* Minikube button */}
          <div className="mb-3">
            <button
              onClick={() => openTab("minikube" as ResourceType)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                activeResource === "minikube"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <HardDrive className="h-4 w-4" />
              Minikube
            </button>
          </div>

          {/* Observability button */}
          {activeContext && activeNamespace && (
            <div className="mb-3">
              <button
                onClick={() => openTab("observability" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "observability"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Activity className="h-4 w-4" />
                Observability
              </button>
            </div>
          )}

          {/* Events button */}
          {activeContext && activeNamespace && (
            <div className="mb-3">
              <button
                onClick={() => openTab("events" as ResourceType)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  activeResource === "events"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Bell className="h-4 w-4" />
                Events
              </button>
            </div>
          )}

          {/* Resource categories (collapsible) */}
          {categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat);
            const catItems = resources.filter((r) => r.category === cat);
            const hasActive = catItems.some((r) => r.type === activeResource);

            return (
              <div key={cat} className="mb-3">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    hasActive
                      ? "text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {cat}
                </button>
                {isExpanded &&
                  catItems.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => openTab(item.type)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        activeResource === item.type
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
              </div>
            );
          })}

          {/* Custom Resources section */}
          {activeContext && (
            <div className="mb-3">
              <button
                onClick={() => setCrdExpanded(!crdExpanded)}
                className="mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {crdExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Custom Resources
              </button>
              {crdExpanded && (
                <div>
                  {crdLoading ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
                  ) : crdGroups.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">No CRDs found</div>
                  ) : (
                    crdGroups.map(([group, groupCrds]) => (
                      <CRDGroupItem
                        key={group}
                        group={group}
                        crds={groupCrds}
                        activeResource={activeResource}
                        onSelect={handleSelectCRD}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
