import { invoke } from "@tauri-apps/api/core";
import type {
  ContextInfo,
  NamespaceInfo,
  PodInfo,
  PodDetailInfo,
  DeploymentInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  ReplicaSetInfo,
  ReplicationControllerInfo,
  JobInfo,
  CronJobInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  IngressInfo,
  IngressDetailInfo,
  GatewayInfo,
  GatewayDetailInfo,
  HTTPRouteDetailInfo,
  GRPCRouteDetailInfo,
  GenericResourceDetailInfo,
  ImageHistoryEntry,
  CRDInfo,
  CRDInstanceInfo,
  PortForwardEntry,
  GenericResourceListItem,
  NetworkGraphData,
  DependencyGraphData,
  IncidentSummary,
  ChangeEvent,
  RolloutTimeline,
  NamespaceEventInfo,
  HelmRelease,
  HelmRevision,
  PodMetrics,
  NamespaceMetricsSummary,
  NodeMetrics,
  ActiveAlertsSummary,
  ContainerUsageSummary,
} from "@/types/k8s";

// Contexts
export const getContexts = () => invoke<ContextInfo[]>("get_contexts");
export const setActiveContext = (name: string) =>
  invoke<void>("set_active_context", { name });

// Namespaces
export const getNamespaces = () => invoke<NamespaceInfo[]>("get_namespaces");
export const setActiveNamespace = (namespace: string) =>
  invoke<void>("set_active_namespace", { namespace });

// Resources
export const getPods = () => invoke<PodInfo[]>("get_pods");
export const getDeployments = () => invoke<DeploymentInfo[]>("get_deployments");
export const getDaemonSets = () => invoke<DaemonSetInfo[]>("get_daemonsets");
export const getStatefulSets = () =>
  invoke<StatefulSetInfo[]>("get_statefulsets");
export const getReplicaSets = () =>
  invoke<ReplicaSetInfo[]>("get_replicasets");
export const getReplicationControllers = () =>
  invoke<ReplicationControllerInfo[]>("get_replication_controllers");
export const getJobs = () => invoke<JobInfo[]>("get_jobs");
export const getCronJobs = () => invoke<CronJobInfo[]>("get_cronjobs");
export const getServices = () => invoke<ServiceInfo[]>("get_services");
export const getConfigMaps = () => invoke<ConfigMapInfo[]>("get_configmaps");
export const getSecrets = () => invoke<SecretInfo[]>("get_secrets");
export const getIngresses = () => invoke<IngressInfo[]>("get_ingresses");
export const getGateways = () => invoke<GatewayInfo[]>("get_gateways");

// Pod actions
export const deletePod = (name: string) => invoke<void>("delete_pod", { name });
export const execPodShell = (name: string, container: string) =>
  invoke<void>("exec_pod_shell", { name, container });

// Pod watch
export const startWatchingPods = () => invoke<void>("start_watching_pods");
export const stopWatchingPods = () => invoke<void>("stop_watching_pods");

// Secret value reveal
export const getSecretValue = (secretName: string, key: string) =>
  invoke<string>("get_secret_value", { secretName, key });
export const getSecretData = (secretName: string) =>
  invoke<Record<string, string>>("get_secret_data", { secretName });

// Detail views
export const getPodDetail = (name: string) =>
  invoke<PodDetailInfo>("get_pod_detail", { name });
export const getIngressDetail = (name: string) =>
  invoke<IngressDetailInfo>("get_ingress_detail", { name });
export const getGatewayDetail = (name: string) =>
  invoke<GatewayDetailInfo>("get_gateway_detail", { name });
export const getHTTPRouteDetail = (name: string) =>
  invoke<HTTPRouteDetailInfo>("get_httproute_detail", { name });
export const getGRPCRouteDetail = (name: string) =>
  invoke<GRPCRouteDetailInfo>("get_grpcroute_detail", { name });

// Image history
export const getImageHistory = (ownerKind: string, ownerName: string, containerName: string) =>
  invoke<ImageHistoryEntry[]>("get_image_history", { ownerKind, ownerName, containerName });

// Resource editing
export interface ResourceCoordinates {
  group: string;
  version: string;
  kind: string;
  plural: string;
  clusterScoped?: boolean;
}

export const getResourceYaml = (coords: ResourceCoordinates, name: string) =>
  invoke<string>("get_resource_yaml", { ...coords, name });

export const updateResourceYaml = (
  coords: ResourceCoordinates,
  name: string,
  yamlContent: string,
) => invoke<void>("update_resource_yaml", { ...coords, name, yamlContent });

export const patchResource = (
  coords: ResourceCoordinates,
  name: string,
  patchJson: Record<string, unknown>,
) => invoke<void>("patch_resource", { ...coords, name, patchJson });

export const getResourceDetail = (coords: ResourceCoordinates, name: string) =>
  invoke<GenericResourceDetailInfo>("get_resource_detail", { ...coords, name });

// Generic resource listing
export const getGenericResources = (
  group: string,
  version: string,
  kind: string,
  plural: string,
  clusterScoped: boolean,
) =>
  invoke<GenericResourceListItem[]>("get_generic_resources", {
    group,
    version,
    kind,
    plural,
    clusterScoped,
  });

// Log streaming
export const startLogStream = (
  sessionId: string,
  targetKind: string,
  targetName: string,
  container?: string,
  tailLines?: number,
  sinceSeconds?: number,
) =>
  invoke<string[]>("start_log_stream", {
    sessionId,
    targetKind,
    targetName,
    container,
    tailLines,
    sinceSeconds,
  });

export const stopLogStream = (sessionId: string) =>
  invoke<void>("stop_log_stream", { sessionId });

// Process environment (for passing to tauri-plugin-pty spawn)
export const getProcessEnv = () =>
  invoke<Record<string, string>>("get_process_env");

// CRDs
export const getCRDs = () => invoke<CRDInfo[]>("get_crds");
export const getCRDInstances = (
  group: string,
  version: string,
  plural: string,
  scope: string,
) => invoke<CRDInstanceInfo[]>("get_crd_instances", { group, version, plural, scope });

// Port forwarding
export const startPortForward = (
  targetKind: string,
  targetName: string,
  remotePort: number,
  localPort?: number,
) =>
  invoke<PortForwardEntry>("start_port_forward", {
    targetKind,
    targetName,
    remotePort,
    localPort,
  });

export const stopPortForward = (id: string) =>
  invoke<void>("stop_port_forward", { id });

export const listPortForwards = () =>
  invoke<PortForwardEntry[]>("list_port_forwards");

// Configuration
export const getConfig = (key: string) =>
  invoke<string | null>("get_config", { key });

export const setConfig = (key: string, value: string) =>
  invoke<void>("set_config", { key, value });

export const deleteConfig = (key: string) =>
  invoke<void>("delete_config", { key });

export const getAllConfig = () =>
  invoke<Record<string, string>>("get_all_config");

// Deployment actions
export const scaleDeployment = (name: string, replicas: number) =>
  invoke<void>("scale_deployment", { name, replicas });

export const restartDeployment = (name: string) =>
  invoke<void>("restart_deployment", { name });

export const getDeploymentInfo = (name: string) =>
  invoke<{
    replicas: number;
    available_replicas: number;
    containers: {
      name: string;
      requests_cpu: string;
      requests_memory: string;
      limits_cpu: string;
      limits_memory: string;
    }[];
  }>("get_deployment_info", { name });

export const updateDeploymentResources = (
  name: string,
  containerName: string,
  requestsCpu: string,
  requestsMemory: string,
  limitsCpu: string,
  limitsMemory: string,
) =>
  invoke<void>("update_deployment_resources", {
    name,
    containerName,
    requestsCpu,
    requestsMemory,
    limitsCpu,
    limitsMemory,
  });

// ExternalSecrets
export const getExternalSecretsForDeployment = (deploymentName: string) =>
  invoke<{ external_secret_name: string; secret_name: string; api_version: string }[]>(
    "get_external_secrets_for_deployment", { deploymentName }
  );

export const forceSyncExternalSecret = (externalSecretName: string, deploymentName: string) =>
  invoke<void>("force_sync_external_secret", { externalSecretName, deploymentName });

// Graph overviews
export const getNetworkGraph = () =>
  invoke<NetworkGraphData>("get_network_graph");

export const getDependencyGraph = () =>
  invoke<DependencyGraphData>("get_dependency_graph");

// Incident Mode
export const getIncidentSummary = () =>
  invoke<IncidentSummary>("get_incident_summary");

export const getWhatChanged = (sinceMinutes: number) =>
  invoke<ChangeEvent[]>("get_what_changed", { sinceMinutes });

export const getRolloutTimeline = (deploymentName: string) =>
  invoke<RolloutTimeline>("get_rollout_timeline", { deploymentName });

export const getNamespaceEvents = (sinceMinutes?: number) =>
  invoke<NamespaceEventInfo[]>("get_namespace_events", { sinceMinutes });

// Helm
export const helmListReleases = () =>
  invoke<HelmRelease[]>("helm_list_releases");

export const helmGetHistory = (releaseName: string) =>
  invoke<HelmRevision[]>("helm_get_history", { releaseName });

export const helmRollback = (releaseName: string, revision: number) =>
  invoke<string>("helm_rollback", { releaseName, revision });

export const helmDiffRevisions = (
  releaseName: string,
  fromRevision: number,
  toRevision: number,
) => invoke<string>("helm_diff_revisions", { releaseName, fromRevision, toRevision });

export const helmGetValues = (releaseName: string, revision: number) =>
  invoke<string>("helm_get_values", { releaseName, revision });

export const helmGetManifest = (releaseName: string, revision: number) =>
  invoke<string>("helm_get_manifest", { releaseName, revision });

export const helmDiffLocal = (releaseName: string, revision: number) =>
  invoke<string>("helm_diff_local", { releaseName, revision });

// New Relic
export const newrelicGetPodMetrics = (context: string, podName: string, namespace: string, timeRangeMinutes: number) =>
  invoke<PodMetrics>("newrelic_get_pod_metrics", { context, podName, namespace, timeRangeMinutes });

export const newrelicGetNamespaceMetrics = (context: string, namespace: string, timeRangeMinutes: number) =>
  invoke<NamespaceMetricsSummary>("newrelic_get_namespace_metrics", { context, namespace, timeRangeMinutes });

export const newrelicGetNodeMetrics = (context: string) =>
  invoke<NodeMetrics[]>("newrelic_get_node_metrics", { context });

export const newrelicGetActiveAlerts = (context: string) =>
  invoke<ActiveAlertsSummary>("newrelic_get_active_alerts", { context });

export const newrelicGetContainerUsage = (context: string, podName: string, namespace: string) =>
  invoke<ContainerUsageSummary>("newrelic_get_container_usage", { context, podName, namespace });

// Chat — Claude CLI integration
export const startChatSession = (
  sessionId: string,
  message: string,
  contextInfo?: string,
  activeResource?: string,
  resourceContext?: string,
) =>
  invoke<void>("start_chat_session", {
    sessionId,
    message,
    contextInfo,
    activeResource,
    resourceContext,
  });

export const sendChatMessage = (sessionId: string, message: string) =>
  invoke<void>("send_chat_message", { sessionId, message });

export const stopChatSession = (sessionId: string) =>
  invoke<void>("stop_chat_session", { sessionId });

export const executeChatAction = (
  actionType: string,
  params: Record<string, unknown>,
) => invoke<string>("execute_chat_action", { actionType, params });

export const checkClaudeCli = () =>
  invoke<boolean>("check_claude_cli");
