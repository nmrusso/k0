import type { ResourceCoordinates } from "./tauri-commands";
import type { ResourceType } from "@/types/k8s";

export const POD_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "Pod",
  plural: "pods",
};

export const DEPLOYMENT_COORDS: ResourceCoordinates = {
  group: "apps",
  version: "v1",
  kind: "Deployment",
  plural: "deployments",
};

export const DAEMONSET_COORDS: ResourceCoordinates = {
  group: "apps",
  version: "v1",
  kind: "DaemonSet",
  plural: "daemonsets",
};

export const STATEFULSET_COORDS: ResourceCoordinates = {
  group: "apps",
  version: "v1",
  kind: "StatefulSet",
  plural: "statefulsets",
};

export const REPLICASET_COORDS: ResourceCoordinates = {
  group: "apps",
  version: "v1",
  kind: "ReplicaSet",
  plural: "replicasets",
};

export const REPLICATIONCONTROLLER_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "ReplicationController",
  plural: "replicationcontrollers",
};

export const JOB_COORDS: ResourceCoordinates = {
  group: "batch",
  version: "v1",
  kind: "Job",
  plural: "jobs",
};

export const CRONJOB_COORDS: ResourceCoordinates = {
  group: "batch",
  version: "v1",
  kind: "CronJob",
  plural: "cronjobs",
};

export const SERVICE_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "Service",
  plural: "services",
};

export const CONFIGMAP_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "ConfigMap",
  plural: "configmaps",
};

export const SECRET_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "Secret",
  plural: "secrets",
};

export const INGRESS_COORDS: ResourceCoordinates = {
  group: "networking.k8s.io",
  version: "v1",
  kind: "Ingress",
  plural: "ingresses",
};

export const GATEWAY_COORDS: ResourceCoordinates = {
  group: "gateway.networking.k8s.io",
  version: "v1",
  kind: "Gateway",
  plural: "gateways",
};

export const HTTPROUTE_COORDS: ResourceCoordinates = {
  group: "gateway.networking.k8s.io",
  version: "v1",
  kind: "HTTPRoute",
  plural: "httproutes",
};

export const GRPCROUTE_COORDS: ResourceCoordinates = {
  group: "gateway.networking.k8s.io",
  version: "v1",
  kind: "GRPCRoute",
  plural: "grpcroutes",
};

// Config extras
export const RESOURCEQUOTA_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "ResourceQuota",
  plural: "resourcequotas",
};

export const LIMITRANGE_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "LimitRange",
  plural: "limitranges",
};

export const HPA_COORDS: ResourceCoordinates = {
  group: "autoscaling",
  version: "v2",
  kind: "HorizontalPodAutoscaler",
  plural: "horizontalpodautoscalers",
};

export const VPA_COORDS: ResourceCoordinates = {
  group: "autoscaling.k8s.io",
  version: "v1",
  kind: "VerticalPodAutoscaler",
  plural: "verticalpodautoscalers",
};

export const PDB_COORDS: ResourceCoordinates = {
  group: "policy",
  version: "v1",
  kind: "PodDisruptionBudget",
  plural: "poddisruptionbudgets",
};

export const PRIORITYCLASS_COORDS: ResourceCoordinates = {
  group: "scheduling.k8s.io",
  version: "v1",
  kind: "PriorityClass",
  plural: "priorityclasses",
  clusterScoped: true,
};

export const RUNTIMECLASS_COORDS: ResourceCoordinates = {
  group: "node.k8s.io",
  version: "v1",
  kind: "RuntimeClass",
  plural: "runtimeclasses",
  clusterScoped: true,
};

export const LEASE_COORDS: ResourceCoordinates = {
  group: "coordination.k8s.io",
  version: "v1",
  kind: "Lease",
  plural: "leases",
};

export const MUTATINGWEBHOOK_COORDS: ResourceCoordinates = {
  group: "admissionregistration.k8s.io",
  version: "v1",
  kind: "MutatingWebhookConfiguration",
  plural: "mutatingwebhookconfigurations",
  clusterScoped: true,
};

export const VALIDATINGWEBHOOK_COORDS: ResourceCoordinates = {
  group: "admissionregistration.k8s.io",
  version: "v1",
  kind: "ValidatingWebhookConfiguration",
  plural: "validatingwebhookconfigurations",
  clusterScoped: true,
};

// Network extras
export const ENDPOINTS_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "Endpoints",
  plural: "endpoints",
};

export const INGRESSCLASS_COORDS: ResourceCoordinates = {
  group: "networking.k8s.io",
  version: "v1",
  kind: "IngressClass",
  plural: "ingressclasses",
  clusterScoped: true,
};

export const NETWORKPOLICY_COORDS: ResourceCoordinates = {
  group: "networking.k8s.io",
  version: "v1",
  kind: "NetworkPolicy",
  plural: "networkpolicies",
};

// Storage
export const PVC_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "PersistentVolumeClaim",
  plural: "persistentvolumeclaims",
};

export const PV_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "PersistentVolume",
  plural: "persistentvolumes",
  clusterScoped: true,
};

export const STORAGECLASS_COORDS: ResourceCoordinates = {
  group: "storage.k8s.io",
  version: "v1",
  kind: "StorageClass",
  plural: "storageclasses",
  clusterScoped: true,
};

// Access Control
export const SERVICEACCOUNT_COORDS: ResourceCoordinates = {
  group: "",
  version: "v1",
  kind: "ServiceAccount",
  plural: "serviceaccounts",
};

export const CLUSTERROLE_COORDS: ResourceCoordinates = {
  group: "rbac.authorization.k8s.io",
  version: "v1",
  kind: "ClusterRole",
  plural: "clusterroles",
  clusterScoped: true,
};

export const ROLE_COORDS: ResourceCoordinates = {
  group: "rbac.authorization.k8s.io",
  version: "v1",
  kind: "Role",
  plural: "roles",
};

export const CLUSTERROLEBINDING_COORDS: ResourceCoordinates = {
  group: "rbac.authorization.k8s.io",
  version: "v1",
  kind: "ClusterRoleBinding",
  plural: "clusterrolebindings",
  clusterScoped: true,
};

export const ROLEBINDING_COORDS: ResourceCoordinates = {
  group: "rbac.authorization.k8s.io",
  version: "v1",
  kind: "RoleBinding",
  plural: "rolebindings",
};

export const RESOURCE_COORDS_MAP: Partial<Record<ResourceType, ResourceCoordinates>> = {
  pods: POD_COORDS,
  deployments: DEPLOYMENT_COORDS,
  daemonsets: DAEMONSET_COORDS,
  statefulsets: STATEFULSET_COORDS,
  replicasets: REPLICASET_COORDS,
  replicationcontrollers: REPLICATIONCONTROLLER_COORDS,
  jobs: JOB_COORDS,
  cronjobs: CRONJOB_COORDS,
  services: SERVICE_COORDS,
  configmaps: CONFIGMAP_COORDS,
  secrets: SECRET_COORDS,
  // Config extras
  resourcequotas: RESOURCEQUOTA_COORDS,
  limitranges: LIMITRANGE_COORDS,
  horizontalpodautoscalers: HPA_COORDS,
  verticalpodautoscalers: VPA_COORDS,
  poddisruptionbudgets: PDB_COORDS,
  priorityclasses: PRIORITYCLASS_COORDS,
  runtimeclasses: RUNTIMECLASS_COORDS,
  leases: LEASE_COORDS,
  mutatingwebhookconfigurations: MUTATINGWEBHOOK_COORDS,
  validatingwebhookconfigurations: VALIDATINGWEBHOOK_COORDS,
  // Network extras
  endpoints: ENDPOINTS_COORDS,
  ingressclasses: INGRESSCLASS_COORDS,
  networkpolicies: NETWORKPOLICY_COORDS,
  // Storage
  persistentvolumeclaims: PVC_COORDS,
  persistentvolumes: PV_COORDS,
  storageclasses: STORAGECLASS_COORDS,
  // Access Control
  serviceaccounts: SERVICEACCOUNT_COORDS,
  clusterroles: CLUSTERROLE_COORDS,
  roles: ROLE_COORDS,
  clusterrolebindings: CLUSTERROLEBINDING_COORDS,
  rolebindings: ROLEBINDING_COORDS,
};

export const CLUSTER_SCOPED_RESOURCES = new Set<string>([
  "priorityclasses",
  "runtimeclasses",
  "mutatingwebhookconfigurations",
  "validatingwebhookconfigurations",
  "ingressclasses",
  "persistentvolumes",
  "storageclasses",
  "clusterroles",
  "clusterrolebindings",
]);
