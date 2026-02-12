import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { startLogStream, stopLogStream } from "@/lib/tauri-commands";
import { usePanelStore } from "@/stores/panelStore";

interface LogDataPayload {
  lines: string[];
}

export function useLogStream(
  tabId: string,
  targetKind: string,
  targetName: string,
  container: string | null | undefined,
) {
  const appendLogLines = usePanelStore((s) => s.appendLogLines);
  const setStreaming = usePanelStore((s) => s.setStreaming);
  const setAvailableContainers = usePanelStore(
    (s) => s.setAvailableContainers,
  );

  useEffect(() => {
    let unlistenData: (() => void) | null = null;
    let unlistenEnd: (() => void) | null = null;
    let cancelled = false;

    async function setup() {
      // Set up listeners BEFORE starting the stream
      unlistenData = await listen<LogDataPayload>(
        `log-data-${tabId}`,
        (event) => {
          if (!cancelled) {
            appendLogLines(tabId, event.payload.lines);
          }
        },
      );

      unlistenEnd = await listen(`log-ended-${tabId}`, () => {
        if (!cancelled) {
          setStreaming(tabId, false);
        }
      });

      if (cancelled) {
        unlistenData?.();
        unlistenEnd?.();
        return;
      }

      // Start the log stream
      try {
        const containers = await startLogStream(
          tabId,
          targetKind,
          targetName,
          container ?? undefined,
        );
        if (!cancelled) {
          setAvailableContainers(tabId, containers);
        }
      } catch (e) {
        if (!cancelled) {
          appendLogLines(tabId, [`[Error starting log stream: ${e}]`]);
          setStreaming(tabId, false);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenEnd?.();
      stopLogStream(tabId).catch(() => {});
    };
    // Only re-run when tabId or container changes — store actions are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, container]);
}
