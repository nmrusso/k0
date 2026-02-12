import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { spawn } from "tauri-pty";
import { getConfig, getProcessEnv } from "@/lib/tauri-commands";
import type { PanelTab } from "@/stores/panelStore";

interface TerminalViewerProps {
  tab: PanelTab;
}

export function TerminalViewer({ tab }: TerminalViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ready, setReady] = useState(false);

  const context = tab.context || "";
  const namespace = tab.namespace || "";
  const podName = tab.podName || "";
  const containerName = tab.containerName || "";

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    let cancelled = false;
    let ptyProcess: ReturnType<typeof spawn> | null = null;
    let observer: ResizeObserver | null = null;

    async function init() {
      const [fontSizeStr, fontFamilyStr, processEnv] = await Promise.all([
        getConfig("terminal_font_size").catch(() => null),
        getConfig("terminal_font_family").catch(() => null),
        getProcessEnv().catch(() => ({})),
      ]);

      if (cancelled) return;

      const fontSize = fontSizeStr ? parseInt(fontSizeStr, 10) || 13 : 13;
      const fontFamily =
        fontFamilyStr ||
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize,
        fontFamily,
        theme: {
          background: "#1a1a2e",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          selectionBackground: "#264f78",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);
      requestAnimationFrame(() => {
        fitAddon.fit();
        setReady(true);
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      if (cancelled) {
        terminal.dispose();
        return;
      }

      try {
        const args = [
          "exec", "-it", podName,
          "-n", namespace,
          "--context", context,
          "-c", containerName,
          "--", "/bin/sh",
        ];

        ptyProcess = spawn("kubectl", args, {
          cols: terminal.cols,
          rows: terminal.rows,
          env: {
            ...(processEnv as Record<string, string>),
            TERM: "xterm-256color",
          },
        });

        if (cancelled) {
          ptyProcess.kill();
          terminal.dispose();
          return;
        }

        ptyProcess.onData((data: Uint8Array) => {
          if (!cancelled) terminal.write(data);
        });

        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
          if (!cancelled) {
            terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
          }
        });

        terminal.onData((data: string) => {
          ptyProcess?.write(data);
        });

        terminal.onResize(({ rows, cols }: { rows: number; cols: number }) => {
          ptyProcess?.resize(cols, rows);
        });
      } catch (e) {
        terminal.write(`\r\n[Error: ${e}]\r\n`);
        setReady(true);
      }

      observer = new ResizeObserver(() => {
        fitAddonRef.current?.fit();
      });
      observer.observe(container);
    }

    init();

    return () => {
      cancelled = true;
      observer?.disconnect();
      ptyProcess?.kill();
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full bg-[#1a1a2e] flex flex-col">
      {/* Context label */}
      <div className="shrink-0 px-3 py-1 text-xs border-b border-border/30 bg-[#1a1a2e]">
        <span className="text-blue-400">
          ▸ Kubernetes context{" "}
          <span className="font-semibold">{context || "default"}</span>
          {" · "}namespace{" "}
          <span className="font-semibold">{namespace || "default"}</span>
          {" · "}pod{" "}
          <span className="font-semibold">{podName}</span>
          {" "}({containerName})
        </span>
      </div>
      {/* Terminal */}
      <div className="min-h-0 flex-1 relative">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a2e]">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Connecting to {podName || "pod"}...</span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
