import {
  getPodDetail,
  newrelicGetPodMetrics,
  newrelicGetContainerUsage,
  newrelicGetActiveAlerts,
  getImageHistory,
  getResourceDetail,
  getIncidentSummary,
  getRolloutTimeline,
  helmGetHistory,
  getNetworkGraph,
  getResourceYaml,
} from "@/lib/tauri-commands";
import type { ResourceCoordinates } from "@/lib/tauri-commands";

const MAX_CONTEXT_CHARS = 12_000;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... (truncated)";
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n... (truncated)";
}

function safe<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

export async function gatherPodContext(
  podName: string,
  context: string,
  namespace: string,
): Promise<string> {
  const [detail, metrics, containerUsage, alerts, imageHistory] =
    await Promise.all([
      safe(getPodDetail(podName)),
      safe(newrelicGetPodMetrics(context, podName, namespace, 60)),
      safe(newrelicGetContainerUsage(context, podName, namespace)),
      safe(newrelicGetActiveAlerts(context)),
      // Try to get image history for the first container's owner
      safe(
        getPodDetail(podName).then((d) => {
          if (!d?.workload_owner || !d.containers[0]) return null;
          return getImageHistory(
            d.workload_owner.kind,
            d.workload_owner.name,
            d.containers[0].name,
          );
        }),
      ),
    ]);

  const parts: string[] = [];

  if (detail) {
    parts.push(`### Pod: ${detail.name}`);
    parts.push(`Status: ${detail.status}`);
    parts.push(`Node: ${detail.node}`);
    parts.push(`IP: ${detail.pod_ip}`);
    parts.push(`QoS: ${detail.qos_class}`);
    parts.push(`Created: ${detail.created}`);
    if (detail.workload_owner) {
      parts.push(
        `Owner: ${detail.workload_owner.kind}/${detail.workload_owner.name}`,
      );
    }

    // Containers
    for (const c of detail.containers) {
      parts.push(`\n#### Container: ${c.name}`);
      parts.push(`Image: ${c.image}`);
      parts.push(`Ready: ${c.ready}, Status: ${c.status}`);
      parts.push(`Restarts: ${c.restart_count}`);
      if (c.requests_cpu || c.requests_memory) {
        parts.push(
          `Requests: CPU=${c.requests_cpu || "none"}, Memory=${c.requests_memory || "none"}`,
        );
      }
      if (c.limits_cpu || c.limits_memory) {
        parts.push(
          `Limits: CPU=${c.limits_cpu || "none"}, Memory=${c.limits_memory || "none"}`,
        );
      }
    }

    // Conditions
    const trueConditions = detail.conditions
      .filter((c) => c.status === "True")
      .map((c) => c.condition_type);
    if (trueConditions.length > 0) {
      parts.push(`\nConditions (True): ${trueConditions.join(", ")}`);
    }

    // Events (max 10)
    if (detail.events.length > 0) {
      parts.push("\n#### Events (recent)");
      for (const ev of detail.events.slice(0, 10)) {
        parts.push(`- [${ev.event_type}] ${ev.reason}: ${ev.message} (${ev.age}, x${ev.count})`);
      }
    }
  }

  // Metrics
  if (metrics && metrics.timeseries.length > 0) {
    const latest = metrics.timeseries[metrics.timeseries.length - 1];
    parts.push("\n#### Metrics (latest)");
    parts.push(
      `CPU: ${(latest.cpu_cores * 1000).toFixed(0)}m, Memory: ${(latest.memory_bytes / (1024 * 1024)).toFixed(0)}Mi`,
    );
  }

  // Container usage
  if (containerUsage) {
    for (const cu of containerUsage.containers) {
      parts.push(`\nContainer Usage (${cu.container_name}):`);
      parts.push(
        `CPU: ${(cu.cpu_used_cores * 1000).toFixed(0)}m / ${cu.cpu_limit_cores > 0 ? (cu.cpu_limit_cores * 1000).toFixed(0) + "m" : "no limit"}`,
      );
      parts.push(
        `Memory: ${(cu.memory_working_set_bytes / (1024 * 1024)).toFixed(0)}Mi / ${cu.memory_limit_bytes > 0 ? (cu.memory_limit_bytes / (1024 * 1024)).toFixed(0) + "Mi" : "no limit"}`,
      );
    }
  }

  // Alerts
  if (alerts && alerts.alerts.length > 0) {
    parts.push(`\n#### Active Alerts: ${alerts.alerts.length}`);
    for (const a of alerts.alerts.slice(0, 5)) {
      parts.push(`- [${a.priority}] ${a.condition_name} (${a.policy_name})`);
    }
  }

  // Image history
  if (imageHistory && imageHistory.length > 0) {
    parts.push("\n#### Image History");
    for (const entry of imageHistory.slice(0, 5)) {
      parts.push(
        `- Rev ${entry.revision}: ${entry.image} (${entry.age})${entry.current ? " [current]" : ""}`,
      );
    }
  }

  return truncate(parts.join("\n"), MAX_CONTEXT_CHARS);
}

export async function gatherDeploymentContext(
  name: string,
  _context: string,
  _namespace: string,
  coords: ResourceCoordinates,
): Promise<string> {
  const [detail, incident, rollout, helmHistory] = await Promise.all([
    safe(getResourceDetail(coords, name)),
    safe(getIncidentSummary()),
    safe(getRolloutTimeline(name)),
    safe(helmGetHistory(name)),
  ]);

  const parts: string[] = [];

  if (detail) {
    parts.push(`### ${coords.kind}: ${detail.name}`);
    parts.push(`Namespace: ${detail.namespace}`);
    parts.push(`Created: ${detail.created}`);

    // Status
    if (detail.status && typeof detail.status === "object") {
      const status = detail.status as Record<string, unknown>;
      if ("replicas" in status) parts.push(`Replicas: ${status.replicas}`);
      if ("readyReplicas" in status) parts.push(`Ready: ${status.readyReplicas}`);
      if ("availableReplicas" in status) parts.push(`Available: ${status.availableReplicas}`);
      if ("unavailableReplicas" in status) parts.push(`Unavailable: ${status.unavailableReplicas}`);
    }

    // Events
    if (detail.events.length > 0) {
      parts.push("\n#### Events (recent)");
      for (const ev of detail.events.slice(0, 10)) {
        parts.push(`- [${ev.event_type}] ${ev.reason}: ${ev.message} (${ev.age}, x${ev.count})`);
      }
    }
  }

  // Incident summary
  if (incident) {
    if (incident.unhealthy_workloads.length > 0) {
      parts.push("\n#### Unhealthy Workloads");
      for (const w of incident.unhealthy_workloads.slice(0, 5)) {
        parts.push(`- ${w.kind}/${w.name}: ready=${w.ready}, restarts=${w.restart_count}`);
      }
    }
  }

  // Rollout timeline
  if (rollout && rollout.steps.length > 0) {
    parts.push("\n#### Rollout Timeline");
    for (const step of rollout.steps.slice(0, 10)) {
      parts.push(`- [${step.step_type}] ${step.description} (${step.timestamp})`);
    }
  }

  // Helm history
  if (helmHistory && helmHistory.length > 0) {
    parts.push("\n#### Helm History");
    for (const rev of helmHistory.slice(0, 5)) {
      parts.push(
        `- Rev ${rev.revision}: ${rev.status} — ${rev.description} (${rev.updated})`,
      );
    }
  }

  return truncate(parts.join("\n"), MAX_CONTEXT_CHARS);
}

export async function gatherNetworkResourceContext(
  name: string,
  kind: string,
  coords: ResourceCoordinates,
): Promise<string> {
  const [detail, networkGraph] = await Promise.all([
    safe(getResourceDetail(coords, name)),
    safe(getNetworkGraph()),
  ]);

  const parts: string[] = [];

  if (detail) {
    parts.push(`### ${kind}: ${detail.name}`);
    parts.push(`Namespace: ${detail.namespace}`);
    parts.push(`Created: ${detail.created}`);

    if (detail.spec) {
      parts.push("\n#### Spec");
      parts.push(truncateLines(JSON.stringify(detail.spec, null, 2), 50));
    }

    if (detail.events.length > 0) {
      parts.push("\n#### Events");
      for (const ev of detail.events.slice(0, 5)) {
        parts.push(`- [${ev.event_type}] ${ev.reason}: ${ev.message}`);
      }
    }
  }

  if (networkGraph) {
    // Find relevant nodes/edges for this resource
    const relevantNodes = networkGraph.nodes.filter(
      (n) => n.label === name,
    );
    if (relevantNodes.length > 0) {
      parts.push("\n#### Network Topology");
      for (const node of relevantNodes) {
        parts.push(`- ${node.node_type}/${node.label} (${node.status})`);
      }
      const nodeIds = new Set(relevantNodes.map((n) => n.id));
      const relevantEdges = networkGraph.edges.filter(
        (e) => nodeIds.has(e.source) || nodeIds.has(e.target),
      );
      if (relevantEdges.length > 0) {
        parts.push("Connections:");
        for (const edge of relevantEdges.slice(0, 10)) {
          parts.push(`  ${edge.source} → ${edge.target} (${edge.label})`);
        }
      }
    }
  }

  return truncate(parts.join("\n"), MAX_CONTEXT_CHARS);
}

export async function gatherGenericContext(
  name: string,
  kind: string,
  coords: ResourceCoordinates,
): Promise<string> {
  const [detail, yaml] = await Promise.all([
    safe(getResourceDetail(coords, name)),
    safe(getResourceYaml(coords, name)),
  ]);

  const parts: string[] = [];

  if (detail) {
    parts.push(`### ${kind}: ${detail.name}`);
    parts.push(`Namespace: ${detail.namespace}`);
    parts.push(`Created: ${detail.created}`);

    if (detail.events.length > 0) {
      parts.push("\n#### Events");
      for (const ev of detail.events.slice(0, 5)) {
        parts.push(`- [${ev.event_type}] ${ev.reason}: ${ev.message}`);
      }
    }
  }

  if (yaml) {
    parts.push("\n#### YAML");
    parts.push(truncateLines(yaml, 200));
  }

  return truncate(parts.join("\n"), MAX_CONTEXT_CHARS);
}
