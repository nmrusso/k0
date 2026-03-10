import type { ResourceCoordinates } from "./tauri-commands";
import type { ResourceType } from "@/types/k8s";

// ---------------------------------------------------------------------------
// Single source of truth — add a new resource type here and it propagates
// everywhere (RESOURCE_COORDS_MAP, named exports, etc.)
// ---------------------------------------------------------------------------
const COORDS_DATA: Record<string, ResourceCoordinates> = {
  // Core workloads
  pods:                       { group: "",                             version: "v1", kind: "Pod",                          plural: "pods" },
  deployments:                { group: "apps",                         version: "v1", kind: "Deployment",                   plural: "deployments" },
  daemonsets:                 { group: "apps",                         version: "v1", kind: "DaemonSet",                    plural: "daemonsets" },
  statefulsets:               { group: "apps",                         version: "v1", kind: "StatefulSet",                  plural: "statefulsets" },
  replicasets:                { group: "apps",                         version: "v1", kind: "ReplicaSet",                   plural: "replicasets" },
  replicationcontrollers:     { group: "",                             version: "v1", kind: "ReplicationController",        plural: "replicationcontrollers" },
  jobs:                       { group: "batch",                        version: "v1", kind: "Job",                          plural: "jobs" },
  cronjobs:                   { group: "batch",                        version: "v1", kind: "CronJob",                      plural: "cronjobs" },
  // Networking
  services:                   { group: "",                             version: "v1", kind: "Service",                      plural: "services" },
  ingresses:                  { group: "networking.k8s.io",            version: "v1", kind: "Ingress",                      plural: "ingresses" },
  gateways:                   { group: "gateway.networking.k8s.io",    version: "v1", kind: "Gateway",                      plural: "gateways" },
  httproutes:                 { group: "gateway.networking.k8s.io",    version: "v1", kind: "HTTPRoute",                   plural: "httproutes" },
  grpcroutes:                 { group: "gateway.networking.k8s.io",    version: "v1", kind: "GRPCRoute",                   plural: "grpcroutes" },
  endpoints:                  { group: "",                             version: "v1", kind: "Endpoints",                    plural: "endpoints" },
  ingressclasses:             { group: "networking.k8s.io",            version: "v1", kind: "IngressClass",                 plural: "ingressclasses",             clusterScoped: true },
  networkpolicies:            { group: "networking.k8s.io",            version: "v1", kind: "NetworkPolicy",                plural: "networkpolicies" },
  // Configuration
  configmaps:                 { group: "",                             version: "v1", kind: "ConfigMap",                    plural: "configmaps" },
  secrets:                    { group: "",                             version: "v1", kind: "Secret",                       plural: "secrets" },
  resourcequotas:             { group: "",                             version: "v1", kind: "ResourceQuota",                plural: "resourcequotas" },
  limitranges:                { group: "",                             version: "v1", kind: "LimitRange",                   plural: "limitranges" },
  horizontalpodautoscalers:   { group: "autoscaling",                  version: "v2", kind: "HorizontalPodAutoscaler",      plural: "horizontalpodautoscalers" },
  verticalpodautoscalers:     { group: "autoscaling.k8s.io",           version: "v1", kind: "VerticalPodAutoscaler",        plural: "verticalpodautoscalers" },
  poddisruptionbudgets:       { group: "policy",                       version: "v1", kind: "PodDisruptionBudget",          plural: "poddisruptionbudgets" },
  priorityclasses:            { group: "scheduling.k8s.io",            version: "v1", kind: "PriorityClass",                plural: "priorityclasses",            clusterScoped: true },
  runtimeclasses:             { group: "node.k8s.io",                  version: "v1", kind: "RuntimeClass",                 plural: "runtimeclasses",             clusterScoped: true },
  leases:                     { group: "coordination.k8s.io",          version: "v1", kind: "Lease",                        plural: "leases" },
  mutatingwebhookconfigurations:   { group: "admissionregistration.k8s.io", version: "v1", kind: "MutatingWebhookConfiguration",   plural: "mutatingwebhookconfigurations",   clusterScoped: true },
  validatingwebhookconfigurations: { group: "admissionregistration.k8s.io", version: "v1", kind: "ValidatingWebhookConfiguration", plural: "validatingwebhookconfigurations", clusterScoped: true },
  // Storage
  persistentvolumeclaims:     { group: "",                             version: "v1", kind: "PersistentVolumeClaim",        plural: "persistentvolumeclaims" },
  persistentvolumes:          { group: "",                             version: "v1", kind: "PersistentVolume",             plural: "persistentvolumes",          clusterScoped: true },
  storageclasses:             { group: "storage.k8s.io",               version: "v1", kind: "StorageClass",                 plural: "storageclasses",             clusterScoped: true },
  // Access Control
  serviceaccounts:            { group: "",                             version: "v1", kind: "ServiceAccount",               plural: "serviceaccounts" },
  clusterroles:               { group: "rbac.authorization.k8s.io",    version: "v1", kind: "ClusterRole",                  plural: "clusterroles",               clusterScoped: true },
  roles:                      { group: "rbac.authorization.k8s.io",    version: "v1", kind: "Role",                         plural: "roles" },
  clusterrolebindings:        { group: "rbac.authorization.k8s.io",    version: "v1", kind: "ClusterRoleBinding",           plural: "clusterrolebindings",        clusterScoped: true },
  rolebindings:               { group: "rbac.authorization.k8s.io",    version: "v1", kind: "RoleBinding",                  plural: "rolebindings" },
};

// ---------------------------------------------------------------------------
// Map & set derived from the single source above
// ---------------------------------------------------------------------------
export const RESOURCE_COORDS_MAP = COORDS_DATA as Partial<Record<ResourceType, ResourceCoordinates>>;

export const CLUSTER_SCOPED_RESOURCES = new Set<string>(
  Object.entries(COORDS_DATA)
    .filter(([, c]) => c.clusterScoped)
    .map(([k]) => k),
);

// ---------------------------------------------------------------------------
// Named exports — kept for backward compatibility with existing imports
// ---------------------------------------------------------------------------
export const POD_COORDS                      = COORDS_DATA.pods;
export const DEPLOYMENT_COORDS               = COORDS_DATA.deployments;
export const DAEMONSET_COORDS                = COORDS_DATA.daemonsets;
export const STATEFULSET_COORDS              = COORDS_DATA.statefulsets;
export const REPLICASET_COORDS               = COORDS_DATA.replicasets;
export const REPLICATIONCONTROLLER_COORDS    = COORDS_DATA.replicationcontrollers;
export const JOB_COORDS                      = COORDS_DATA.jobs;
export const CRONJOB_COORDS                  = COORDS_DATA.cronjobs;
export const SERVICE_COORDS                  = COORDS_DATA.services;
export const CONFIGMAP_COORDS                = COORDS_DATA.configmaps;
export const SECRET_COORDS                   = COORDS_DATA.secrets;
export const INGRESS_COORDS                  = COORDS_DATA.ingresses;
export const GATEWAY_COORDS                  = COORDS_DATA.gateways;
export const HTTPROUTE_COORDS                = COORDS_DATA.httproutes;
export const GRPCROUTE_COORDS                = COORDS_DATA.grpcroutes;
export const RESOURCEQUOTA_COORDS            = COORDS_DATA.resourcequotas;
export const LIMITRANGE_COORDS               = COORDS_DATA.limitranges;
export const HPA_COORDS                      = COORDS_DATA.horizontalpodautoscalers;
export const VPA_COORDS                      = COORDS_DATA.verticalpodautoscalers;
export const PDB_COORDS                      = COORDS_DATA.poddisruptionbudgets;
export const PRIORITYCLASS_COORDS            = COORDS_DATA.priorityclasses;
export const RUNTIMECLASS_COORDS             = COORDS_DATA.runtimeclasses;
export const LEASE_COORDS                    = COORDS_DATA.leases;
export const MUTATINGWEBHOOK_COORDS          = COORDS_DATA.mutatingwebhookconfigurations;
export const VALIDATINGWEBHOOK_COORDS        = COORDS_DATA.validatingwebhookconfigurations;
export const ENDPOINTS_COORDS                = COORDS_DATA.endpoints;
export const INGRESSCLASS_COORDS             = COORDS_DATA.ingressclasses;
export const NETWORKPOLICY_COORDS            = COORDS_DATA.networkpolicies;
export const PVC_COORDS                      = COORDS_DATA.persistentvolumeclaims;
export const PV_COORDS                       = COORDS_DATA.persistentvolumes;
export const STORAGECLASS_COORDS             = COORDS_DATA.storageclasses;
export const SERVICEACCOUNT_COORDS           = COORDS_DATA.serviceaccounts;
export const CLUSTERROLE_COORDS              = COORDS_DATA.clusterroles;
export const ROLE_COORDS                     = COORDS_DATA.roles;
export const CLUSTERROLEBINDING_COORDS       = COORDS_DATA.clusterrolebindings;
export const ROLEBINDING_COORDS              = COORDS_DATA.rolebindings;
