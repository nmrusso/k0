import { useState, useEffect, useRef, useCallback } from "react";
import {
  getPods,
  getDeployments,
  getDaemonSets,
  getStatefulSets,
  getServices,
  getConfigMaps,
  getSecrets,
  getIngresses,
  getJobs,
  getCronJobs,
} from "@/lib/tauri-commands";
import type { ResourceType } from "@/types/k8s";

export interface SearchResult {
  resourceType: ResourceType;
  name: string;
  typeLabel: string;
}

interface ResourceFetcher {
  type: ResourceType;
  label: string;
  fetch: () => Promise<{ name: string }[]>;
}

const fetchers: ResourceFetcher[] = [
  { type: "pods", label: "Pod", fetch: getPods },
  { type: "deployments", label: "Deployment", fetch: getDeployments },
  { type: "daemonsets", label: "DaemonSet", fetch: getDaemonSets },
  { type: "statefulsets", label: "StatefulSet", fetch: getStatefulSets },
  { type: "services", label: "Service", fetch: getServices },
  { type: "configmaps", label: "ConfigMap", fetch: getConfigMaps },
  { type: "secrets", label: "Secret", fetch: getSecrets },
  { type: "ingresses", label: "Ingress", fetch: getIngresses },
  { type: "jobs", label: "Job", fetch: getJobs },
  { type: "cronjobs", label: "CronJob", fetch: getCronJobs },
];

interface CacheEntry {
  key: string;
  data: { type: ResourceType; label: string; names: string[] }[];
}

export function useCommandSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<CacheEntry | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const settled = await Promise.allSettled(
        fetchers.map(async (f) => {
          const items = await f.fetch();
          return { type: f.type, label: f.label, names: items.map((i) => i.name) };
        }),
      );
      const data = settled
        .filter((r): r is PromiseFulfilledResult<{ type: ResourceType; label: string; names: string[] }> => r.status === "fulfilled")
        .map((r) => r.value);

      cacheRef.current = { key: "loaded", data };
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      return;
    }

    const search = async () => {
      let data = cacheRef.current?.data;
      if (!data) {
        data = await fetchAll();
      }
      if (!data) return;

      const q = query.toLowerCase().trim();
      if (!q) {
        setResults([]);
        return;
      }

      const matched: SearchResult[] = [];
      for (const group of data) {
        for (const name of group.names) {
          if (name.toLowerCase().includes(q)) {
            matched.push({
              resourceType: group.type,
              name,
              typeLabel: group.label,
            });
          }
        }
        if (matched.length >= 50) break;
      }

      setResults(matched.slice(0, 50));
    };

    search();
  }, [query, enabled, fetchAll]);

  // Invalidate cache when palette closes
  useEffect(() => {
    if (!enabled) {
      cacheRef.current = null;
    }
  }, [enabled]);

  return { results, loading };
}
