import { useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { getConfig, setActiveContext, setActiveNamespace as backendSetNamespace } from "@/lib/tauri-commands";
import { useClusterStore } from "@/stores/clusterStore";

function App() {
  const setContext = useClusterStore((s) => s.setActiveContext);
  const setNamespace = useClusterStore((s) => s.setActiveNamespace);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadDefaults() {
      try {
        const defaultCtx = await getConfig("default_context");
        if (defaultCtx) {
          await setActiveContext(defaultCtx);
          setContext(defaultCtx);

          const defaultNs = await getConfig("default_namespace");
          if (defaultNs) {
            await backendSetNamespace(defaultNs);
            setNamespace(defaultNs);
          }
        }
      } catch {
        // Defaults not set or context not available, ignore
      }
    }

    loadDefaults();
  }, [setContext, setNamespace]);

  return (
    <div className="dark">
      <MainLayout />
    </div>
  );
}

export default App;
