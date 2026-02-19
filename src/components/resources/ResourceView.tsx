import { useClusterStore } from "@/stores/clusterStore";
import { PodTable } from "./PodTable";
import { PodDetail } from "./PodDetail";
import { DeploymentTable } from "./DeploymentTable";
import { DaemonSetTable } from "./DaemonSetTable";
import { StatefulSetTable } from "./StatefulSetTable";
import { ReplicaSetTable } from "./ReplicaSetTable";
import { ReplicationControllerTable } from "./ReplicationControllerTable";
import { JobTable } from "./JobTable";
import { CronJobTable } from "./CronJobTable";
import { ServiceTable } from "./ServiceTable";
import { IngressTable } from "./IngressTable";
import { IngressDetail } from "./IngressDetail";
import { GatewayTable } from "./GatewayTable";
import { GatewayDetail } from "./GatewayDetail";
import { ConfigMapTable } from "./ConfigMapTable";
import { SecretTable } from "./SecretTable";
import { CRDInstanceTable } from "./CRDInstanceTable";
import { GenericResourceTable } from "./GenericResourceTable";
import { GenericResourceDetail } from "./GenericResourceDetail";
import { NetworkOverview } from "./NetworkOverview";
import { DependencyOverview } from "./DependencyOverview";
import { ErrorsDashboard } from "./ErrorsDashboard";
import { IncidentDashboard } from "./IncidentDashboard";
import { HelmReleasesView } from "./HelmReleasesView";
import { ObservabilityView } from "./ObservabilityView";
import { EventsView } from "./EventsView";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { RefreshCw } from "lucide-react";
import { RESOURCE_COORDS_MAP, CLUSTER_SCOPED_RESOURCES } from "@/lib/resource-coords";

const RESOURCE_LABELS: Record<string, string> = {
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
  resourcequotas: "ResourceQuotas",
  limitranges: "LimitRanges",
  horizontalpodautoscalers: "HorizontalPodAutoscalers",
  verticalpodautoscalers: "VerticalPodAutoscalers",
  poddisruptionbudgets: "PodDisruptionBudgets",
  priorityclasses: "PriorityClasses",
  runtimeclasses: "RuntimeClasses",
  leases: "Leases",
  mutatingwebhookconfigurations: "MutatingWebhookConfigurations",
  validatingwebhookconfigurations: "ValidatingWebhookConfigurations",
  endpoints: "Endpoints",
  ingressclasses: "IngressClasses",
  networkpolicies: "NetworkPolicies",
  persistentvolumeclaims: "PersistentVolumeClaims",
  persistentvolumes: "PersistentVolumes",
  storageclasses: "StorageClasses",
  serviceaccounts: "ServiceAccounts",
  clusterroles: "ClusterRoles",
  roles: "Roles",
  clusterrolebindings: "ClusterRoleBindings",
  rolebindings: "RoleBindings",
};

const ORIGINAL_RESOURCE_TYPES = new Set([
  "pods", "deployments", "daemonsets", "statefulsets", "replicasets",
  "replicationcontrollers", "jobs", "cronjobs", "services", "ingresses",
  "gateways", "configmaps", "secrets",
]);

export function ResourceView() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const activeResource = useClusterStore((s) => s.activeResource);
  const selectedPod = useClusterStore((s) => s.selectedPod);
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const selectedIngress = useClusterStore((s) => s.selectedIngress);
  const selectedGateway = useClusterStore((s) => s.selectedGateway);
  const selectedResourceName = useClusterStore((s) => s.selectedResourceName);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);
  const setSelectedResourceName = useClusterStore(
    (s) => s.setSelectedResourceName,
  );

  const isCRD = activeResource.startsWith("crd:");
  // CRD format: "crd:group/version/plural/scope"
  const crdParts = isCRD ? activeResource.slice(4).split("/") : [];
  const crdLabel = isCRD ? crdParts[crdParts.length - 2] || activeResource : "";
  const isCRDClusterScoped = isCRD && crdParts[crdParts.length - 1] === "Cluster";
  const isOverview = activeResource === "overview" || activeResource === "network-overview" || activeResource === "log-errors" || activeResource === "incident-mode" || activeResource === "helm-releases" || activeResource === "observability" || activeResource === "events";
  const isClusterScopedResource = isCRDClusterScoped || CLUSTER_SCOPED_RESOURCES.has(activeResource);

  if (!activeContext) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p className="text-lg">Select a cluster to get started</p>
          <p className="mt-1 text-sm">
            Choose a Kubernetes context from the top bar
          </p>
        </div>
      </div>
    );
  }

  if (!activeNamespace && !isClusterScopedResource && !isOverview) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">Select a namespace</p>
          <p className="mt-1 text-sm">
            Choose a namespace from the top bar to view resources
          </p>
        </div>
      </div>
    );
  }

  if (activeResource === "overview") {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Dependency Overview</h2>
        <DependencyOverview />
      </div>
    );
  }

  if (activeResource === "network-overview") {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Network Overview</h2>
        <NetworkOverview />
      </div>
    );
  }

  if (activeResource === "log-errors") {
    return <ErrorsDashboard />;
  }

  if (activeResource === "incident-mode") {
    return <IncidentDashboard />;
  }

  if (activeResource === "helm-releases") {
    return <HelmReleasesView />;
  }

  if (activeResource === "observability") {
    return <ObservabilityView />;
  }

  if (activeResource === "events") {
    return <EventsView />;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">
        {isCRD ? crdLabel : (RESOURCE_LABELS[activeResource] || activeResource)}
      </h2>
      {activeResource === "pods" && <PodTable />}
      {activeResource === "deployments" && <DeploymentTable />}
      {activeResource === "daemonsets" && <DaemonSetTable />}
      {activeResource === "statefulsets" && <StatefulSetTable />}
      {activeResource === "replicasets" && <ReplicaSetTable />}
      {activeResource === "replicationcontrollers" && (
        <ReplicationControllerTable />
      )}
      {activeResource === "jobs" && <JobTable />}
      {activeResource === "cronjobs" && <CronJobTable />}
      {activeResource === "services" && <ServiceTable />}
      {activeResource === "ingresses" && <IngressTable />}
      {activeResource === "gateways" && <GatewayTable />}
      {activeResource === "configmaps" && <ConfigMapTable />}
      {activeResource === "secrets" && <SecretTable />}
      {isCRD && <CRDInstanceTable />}
      {!isCRD && !ORIGINAL_RESOURCE_TYPES.has(activeResource) && activeResource in RESOURCE_COORDS_MAP && (
        <GenericResourceTable />
      )}

      {/* Pod detail drawer */}
      <Sheet
        open={activeResource === "pods" && !!selectedPod}
        onOpenChange={(open) => {
          if (!open) setSelectedPod(null);
        }}
      >
        <SheetContent>
          <PodDetail />
        </SheetContent>
      </Sheet>

      {/* Ingress detail drawer */}
      <Sheet
        open={activeResource === "ingresses" && !!selectedIngress}
        onOpenChange={(open) => {
          if (!open) setSelectedIngress(null);
        }}
      >
        <SheetContent>
          <IngressDetail />
        </SheetContent>
      </Sheet>

      {/* Gateway detail drawer */}
      <Sheet
        open={activeResource === "gateways" && !!selectedGateway}
        onOpenChange={(open) => {
          if (!open) setSelectedGateway(null);
        }}
      >
        <SheetContent>
          <GatewayDetail />
        </SheetContent>
      </Sheet>

      {/* Generic resource detail drawer (for non-pod/ingress/gateway resources with coords) */}
      <Sheet
        open={!!selectedResourceName && activeResource !== "pods" && activeResource !== "ingresses" && activeResource !== "gateways" && (activeResource in RESOURCE_COORDS_MAP || isCRD)}
        onOpenChange={(open) => {
          if (!open) setSelectedResourceName(null);
        }}
      >
        <SheetContent>
          <GenericResourceDetail />
        </SheetContent>
      </Sheet>
    </div>
  );
}
