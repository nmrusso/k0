import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ResourceType, PodInfo } from "@/types/k8s";
import {
  getPods,
  getDeployments,
  getDaemonSets,
  getStatefulSets,
  getReplicaSets,
  getReplicationControllers,
  getJobs,
  getCronJobs,
  getServices,
  getConfigMaps,
  getSecrets,
  getIngresses,
  getGateways,
  getGenericResources,
  startWatchingPods,
  stopWatchingPods,
} from "@/lib/tauri-commands";
import { useClusterStore } from "@/stores/clusterStore";
import { RESOURCE_COORDS_MAP, CLUSTER_SCOPED_RESOURCES } from "@/lib/resource-coords";

const fetcherMap: Partial<Record<ResourceType, () => Promise<unknown[]>>> = {
  pods: getPods,
  deployments: getDeployments,
  daemonsets: getDaemonSets,
  statefulsets: getStatefulSets,
  replicasets: getReplicaSets,
  replicationcontrollers: getReplicationControllers,
  jobs: getJobs,
  cronjobs: getCronJobs,
  services: getServices,
  ingresses: getIngresses,
  gateways: getGateways,
  configmaps: getConfigMaps,
  secrets: getSecrets,
};

export function useResources<T = unknown>() {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const activeResource = useClusterStore((s) => s.activeResource);

  const refresh = useCallback(async () => {
    const isClusterScoped = CLUSTER_SCOPED_RESOURCES.has(activeResource);

    if (!activeContext || (!activeNamespace && !isClusterScoped)) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetcher = fetcherMap[activeResource];
      if (fetcher) {
        const result = await fetcher();
        setData(result as T[]);
      } else {
        // Fall through to generic resource fetcher
        const coords = RESOURCE_COORDS_MAP[activeResource];
        if (coords) {
          const result = await getGenericResources(
            coords.group,
            coords.version,
            coords.kind,
            coords.plural,
            coords.clusterScoped ?? false,
          );
          setData(result as T[]);
        } else {
          setData([]);
        }
      }
    } catch (e) {
      setError(String(e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeContext, activeNamespace, activeResource]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pod watch subscription
  useEffect(() => {
    if (activeResource !== "pods" || !activeContext || !activeNamespace) return;

    let unlisten: (() => void) | null = null;

    startWatchingPods().catch(console.error);

    listen<PodInfo[]>("pods-changed", (event) => {
      setData(event.payload as T[]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      stopWatchingPods().catch(console.error);
      unlisten?.();
    };
  }, [activeContext, activeNamespace, activeResource]);

  return { data, loading, error, refresh };
}
