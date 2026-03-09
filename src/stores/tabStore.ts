import { create } from "zustand";
import type { ResourceType } from "@/types/k8s";

export interface ResourceTab {
  id: string;
  resourceType: ResourceType;
  label: string;
  scrollTop: number;
}

/** Map resource types to human-readable labels */
const RESOURCE_LABELS: Partial<Record<string, string>> = {
  pods: "Pods",
  deployments: "Deployments",
  daemonsets: "DaemonSets",
  statefulsets: "StatefulSets",
  replicasets: "ReplicaSets",
  replicationcontrollers: "ReplicationControllers",
  jobs: "Jobs",
  cronjobs: "CronJobs",
  services: "Services",
  ingresses: "Ingresses",
  gateways: "Gateways",
  configmaps: "ConfigMaps",
  secrets: "Secrets",
  endpoints: "Endpoints",
  ingressclasses: "IngressClasses",
  networkpolicies: "NetworkPolicies",
  resourcequotas: "ResourceQuotas",
  limitranges: "LimitRanges",
  horizontalpodautoscalers: "HPA",
  verticalpodautoscalers: "VPA",
  poddisruptionbudgets: "PDB",
  priorityclasses: "PriorityClasses",
  runtimeclasses: "RuntimeClasses",
  leases: "Leases",
  mutatingwebhookconfigurations: "MutatingWebhooks",
  validatingwebhookconfigurations: "ValidatingWebhooks",
  persistentvolumeclaims: "PVCs",
  persistentvolumes: "PVs",
  storageclasses: "StorageClasses",
  serviceaccounts: "ServiceAccounts",
  roles: "Roles",
  clusterroles: "ClusterRoles",
  rolebindings: "RoleBindings",
  clusterrolebindings: "ClusterRoleBindings",
  overview: "Overview",
  "network-overview": "Network",
  "log-errors": "Errors",
  "incident-mode": "Incident Mode",
  "helm-releases": "Helm Releases",
  minikube: "Minikube",
  observability: "Observability",
  events: "Events",
};

function getLabel(resourceType: ResourceType): string {
  if (resourceType.startsWith("crd:")) {
    // "crd:group/version/plural/scope" → extract plural
    const parts = resourceType.split("/");
    return parts[2] || resourceType;
  }
  return RESOURCE_LABELS[resourceType] || resourceType;
}

interface TabState {
  tabs: ResourceTab[];
  activeTabId: string | null;
  openTab: (resourceType: ResourceType) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  saveScroll: (id: string, scrollTop: number) => void;
  getActiveTab: () => ResourceTab | undefined;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (resourceType) => {
    const existing = get().tabs.find((t) => t.resourceType === resourceType);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const id = crypto.randomUUID();
    const tab: ResourceTab = {
      id,
      resourceType,
      label: getLabel(resourceType),
      scrollTop: 0,
    };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
  },

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        // Activate the next tab, or the previous, or null
        const closedIdx = s.tabs.findIndex((t) => t.id === id);
        activeTabId = tabs[Math.min(closedIdx, tabs.length - 1)]?.id ?? null;
      }
      return { tabs, activeTabId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  saveScroll: (id, scrollTop) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, scrollTop } : t)),
    })),

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },
}));
