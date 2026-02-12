export interface ContextInfo {
  name: string;
  cluster: string;
  user: string;
  namespace: string | null;
  is_active: boolean;
}

export interface NamespaceInfo {
  name: string;
  status: string;
  age: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node: string;
  ip: string;
  workload_kind: string;
  workload_name: string;
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  ready: string;
  up_to_date: number;
  available: number;
  age: string;
}

export interface DaemonSetInfo {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  available: number;
  age: string;
}

export interface StatefulSetInfo {
  name: string;
  namespace: string;
  ready: string;
  age: string;
}

export interface ReplicaSetInfo {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
}

export interface ReplicationControllerInfo {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
}

export interface JobInfo {
  name: string;
  namespace: string;
  completions: string;
  duration: string;
  age: string;
  status: string;
}

export interface CronJobInfo {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  last_schedule: string;
  age: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  service_type: string;
  cluster_ip: string;
  external_ip: string;
  ports: string;
  age: string;
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  data_count: number;
  age: string;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  secret_type: string;
  data_count: number;
  age: string;
}

// Pod Detail types
export interface PodDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  controlled_by: OwnerRefInfo[];
  workload_owner: OwnerRefInfo | null;
  status: string;
  node: string;
  pod_ip: string;
  pod_ips: string[];
  service_account: string;
  qos_class: string;
  conditions: PodConditionInfo[];
  tolerations: TolerationInfo[];
  volumes: VolumeInfo[];
  containers: ContainerDetailInfo[];
  events: EventInfo[];
}

export interface OwnerRefInfo {
  kind: string;
  name: string;
}

export interface PodConditionInfo {
  condition_type: string;
  status: string;
}

export interface TolerationInfo {
  key: string;
  operator: string;
  value: string;
  effect: string;
}

export interface VolumeInfo {
  name: string;
  volume_type: string;
  source: string;
  sources: VolumeSourceInfo[];
}

export interface VolumeSourceInfo {
  source_type: string;
  name: string;
  detail: string;
}

export interface ContainerDetailInfo {
  name: string;
  image: string;
  status: string;
  ready: boolean;
  restart_count: number;
  ports: string[];
  env_vars: EnvVarInfo[];
  mounts: MountInfo[];
  liveness: ProbeInfo | null;
  readiness: ProbeInfo | null;
  command: string[];
  args: string[];
  requests_cpu: string;
  requests_memory: string;
  limits_cpu: string;
  limits_memory: string;
}

export interface EnvVarInfo {
  name: string;
  value: string;
  source: string;
  source_name: string;
  source_key: string;
}

export interface MountInfo {
  name: string;
  mount_path: string;
  read_only: boolean;
  sub_path: string;
}

export interface ProbeInfo {
  probe_type: string;
  details: string;
  delay: number;
  timeout: number;
  period: number;
  success_threshold: number;
  failure_threshold: number;
}

export interface EventInfo {
  reason: string;
  message: string;
  count: number;
  age: string;
  event_type: string;
}

export interface IngressInfo {
  name: string;
  namespace: string;
  class: string;
  hosts: string;
  address: string;
  ports: string;
  age: string;
}

export interface GatewayInfo {
  name: string;
  namespace: string;
  gateway_class: string;
  addresses: string;
  listeners: number;
  age: string;
}

// Ingress Detail types
export interface IngressDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  controlled_by: OwnerRefInfo[];
  class: string;
  default_backend: string;
  rules: IngressRuleInfo[];
  tls: IngressTlsInfo[];
  addresses: string[];
  events: EventInfo[];
}

export interface IngressRuleInfo {
  host: string;
  paths: IngressPathInfo[];
}

export interface IngressPathInfo {
  path: string;
  path_type: string;
  backend_service: string;
  backend_port: string;
}

export interface IngressTlsInfo {
  hosts: string[];
  secret_name: string;
}

// Gateway Detail types
export interface GatewayDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  finalizers: string[];
  controlled_by: OwnerRefInfo[];
  gateway_class: string;
  addresses: GatewayAddressInfo[];
  listeners: GatewayListenerInfo[];
  conditions: GatewayConditionInfo[];
  http_routes: RouteInfo[];
  grpc_routes: RouteInfo[];
  events: EventInfo[];
}

export interface GatewayAddressInfo {
  address_type: string;
  value: string;
}

export interface GatewayListenerInfo {
  name: string;
  protocol: string;
  port: number;
  hostname: string;
  tls_mode: string;
  tls_certificate_refs: string[];
  allowed_routes: string;
  attached_routes: number;
  conditions: GatewayConditionInfo[];
}

export interface GatewayConditionInfo {
  condition_type: string;
  status: string;
  reason: string;
  message: string;
}

export interface RouteInfo {
  name: string;
  namespace: string;
  hostnames: string[];
  age: string;
}

// HTTPRoute Detail types
export interface HTTPRouteDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  controlled_by: OwnerRefInfo[];
  parent_refs: RouteParentRefInfo[];
  hostnames: string[];
  rules: HTTPRouteRuleInfo[];
  conditions: GatewayConditionInfo[];
  events: EventInfo[];
}

export interface RouteParentRefInfo {
  group: string;
  kind: string;
  name: string;
  namespace: string;
  section_name: string;
}

export interface HTTPRouteRuleInfo {
  matches: HTTPRouteMatchInfo[];
  backend_refs: RouteBackendRefInfo[];
  filters: string[];
}

export interface HTTPRouteMatchInfo {
  path_type: string;
  path_value: string;
  method: string;
  headers: string[];
}

export interface RouteBackendRefInfo {
  kind: string;
  name: string;
  port: number;
  weight: number;
}

// GRPCRoute Detail types
export interface GRPCRouteDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  controlled_by: OwnerRefInfo[];
  parent_refs: RouteParentRefInfo[];
  hostnames: string[];
  rules: GRPCRouteRuleInfo[];
  conditions: GatewayConditionInfo[];
  events: EventInfo[];
}

export interface GRPCRouteRuleInfo {
  matches: GRPCRouteMatchInfo[];
  backend_refs: RouteBackendRefInfo[];
}

export interface GRPCRouteMatchInfo {
  method_service: string;
  method_method: string;
  match_type: string;
  headers: string[];
}

// Generic Resource Detail types
export interface GenericResourceDetailInfo {
  name: string;
  namespace: string;
  created: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  controlled_by: OwnerRefInfo[];
  finalizers: string[];
  spec: unknown;
  status: unknown;
  extra: Record<string, unknown>;
  events: EventInfo[];
}

export interface ImageHistoryEntry {
  revision: string;
  image: string;
  age: string;
  current: boolean;
}

export interface CRDInfo {
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  scope: string;
}

export interface CRDInstanceInfo {
  name: string;
  namespace: string;
  age: string;
}

export interface GenericResourceListItem {
  name: string;
  namespace: string;
  age: string;
  status: string;
}

export interface GraphNode {
  id: string;
  label: string;
  node_type: string;
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface NetworkGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DependencyGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PortForwardEntry {
  id: string;
  target_kind: string;
  target_name: string;
  local_port: number;
  remote_port: number;
}

// Incident Mode types
export interface IncidentSummary {
  unhealthy_workloads: UnhealthyWorkload[];
  recent_changes: ChangeEvent[];
  error_events: NamespaceEventInfo[];
  saturation: WorkloadSaturation[];
  affected_routes: AffectedRoute[];
}

export interface UnhealthyWorkload {
  name: string;
  kind: string;
  ready: string;
  restart_count: number;
  pod_errors: string[];
  events: EventInfo[];
}

export interface NamespaceEventInfo {
  involved_kind: string;
  involved_name: string;
  reason: string;
  message: string;
  count: number;
  event_type: string;
  timestamp: string;
  age: string;
}

export interface ChangeEvent {
  timestamp: string;
  change_type: string;
  resource_kind: string;
  resource_name: string;
  description: string;
  details: ChangeDetails;
}

export type ChangeDetails =
  | { type: "ImageUpdate"; old_image: string; new_image: string; revision: string }
  | { type: "ConfigChange"; resource_version: string }
  | { type: "ScaleChange"; old_replicas: number; new_replicas: number }
  | { type: "Restart"; triggered_at: string }
  | { type: "HPAScale"; current_replicas: number; desired_replicas: number; metric_status: string }
  | { type: "NewReplicaSet"; name: string; revision: string; image: string }
  | { type: "Generic"; info: string };

export interface RolloutTimeline {
  deployment_name: string;
  steps: RolloutStep[];
}

export interface RolloutStep {
  timestamp: string;
  step_type: string;
  description: string;
  old_rs: ReplicaSetSnapshot | null;
  new_rs: ReplicaSetSnapshot | null;
  events: EventInfo[];
}

export interface ReplicaSetSnapshot {
  name: string;
  revision: string;
  replicas: number;
  ready: number;
  image: string;
}

export interface WorkloadSaturation {
  workload_name: string;
  workload_kind: string;
  desired_replicas: number;
  ready_replicas: number;
  pods: PodSaturationInfo[];
}

export interface PodSaturationInfo {
  name: string;
  status: string;
  restarts: number;
  requests_cpu: string;
  requests_memory: string;
  limits_cpu: string;
  limits_memory: string;
}

export interface AffectedRoute {
  route_type: string;
  route_name: string;
  hosts: string[];
  paths: string[];
  backend_service: string;
  backend_healthy: boolean;
}

// Helm types
export interface HelmRelease {
  name: string;
  namespace: string;
  revision: string;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
}

export interface HelmRevision {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
  description: string;
}

export type ResourceType =
  | "pods"
  | "deployments"
  | "daemonsets"
  | "statefulsets"
  | "replicasets"
  | "replicationcontrollers"
  | "jobs"
  | "cronjobs"
  | "services"
  | "ingresses"
  | "gateways"
  | "configmaps"
  | "secrets"
  // Config extras
  | "resourcequotas"
  | "limitranges"
  | "horizontalpodautoscalers"
  | "verticalpodautoscalers"
  | "poddisruptionbudgets"
  | "priorityclasses"
  | "runtimeclasses"
  | "leases"
  | "mutatingwebhookconfigurations"
  | "validatingwebhookconfigurations"
  // Network extras
  | "endpoints"
  | "ingressclasses"
  | "networkpolicies"
  // Storage
  | "persistentvolumeclaims"
  | "persistentvolumes"
  | "storageclasses"
  // Access Control
  | "serviceaccounts"
  | "clusterroles"
  | "roles"
  | "clusterrolebindings"
  | "rolebindings"
  // Overview pages
  | "overview"
  | "network-overview"
  | "log-errors"
  | "incident-mode"
  | "helm-releases"
  | (string & {});  // Allow CRD resource types like "crd:group/version/plural/scope"
