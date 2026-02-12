import { useState, useEffect, useCallback } from "react";
import type { ContextInfo } from "@/types/k8s";
import { getContexts, setActiveContext } from "@/lib/tauri-commands";
import { useClusterStore } from "@/stores/clusterStore";

export function useContexts() {
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setStoreContext = useClusterStore((s) => s.setActiveContext);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getContexts();
      setContexts(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectContext = useCallback(
    async (name: string) => {
      try {
        await setActiveContext(name);
        setStoreContext(name);
      } catch (e) {
        setError(String(e));
      }
    },
    [setStoreContext],
  );

  return { contexts, loading, error, refresh, selectContext };
}
