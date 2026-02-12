import { useState, useEffect, useCallback } from "react";
import type { NamespaceInfo } from "@/types/k8s";
import { getNamespaces, setActiveNamespace } from "@/lib/tauri-commands";
import { useClusterStore } from "@/stores/clusterStore";

export function useNamespaces() {
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeContext = useClusterStore((s) => s.activeContext);
  const setStoreNamespace = useClusterStore((s) => s.setActiveNamespace);

  const refresh = useCallback(async () => {
    if (!activeContext) {
      setNamespaces([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getNamespaces();
      setNamespaces(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeContext]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectNamespace = useCallback(
    async (name: string) => {
      try {
        await setActiveNamespace(name);
        setStoreNamespace(name);
      } catch (e) {
        setError(String(e));
      }
    },
    [setStoreNamespace],
  );

  return { namespaces, loading, error, refresh, selectNamespace };
}
