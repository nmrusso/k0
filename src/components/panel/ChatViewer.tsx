// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Loader2, User, Bot } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useChatStream } from "@/hooks/useChatStream";
import { useClusterStore } from "@/stores/clusterStore";
import { sendChatMessage } from "@/lib/tauri-commands";
import { ChatActionCard } from "./ChatActionCard";
import type { PanelTab } from "@/stores/panelStore";

interface ChatViewerProps {
  tab: PanelTab;
}

export function ChatViewer({ tab }: ChatViewerProps) {
  const [input, setInput] = useState("");
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const session = useChatStore((s) => s.sessions[tab.id]);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendAssistantText = useChatStore((s) => s.appendAssistantText);
  const finalizeAssistantMessage = useChatStore((s) => s.finalizeAssistantMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);

  // Only start the stream once we have an initial message
  useChatStream(
    tab.id,
    initialMessage,
    tab.context ?? activeContext ?? undefined,
    undefined,
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    addUserMessage(tab.id, trimmed);
    setInput("");

    if (!initialMessage) {
      // First message — triggers the useChatStream to start the session
      setInitialMessage(trimmed);
    } else {
      // Follow-up message — send via stdin
      setStreaming(tab.id, true);
      const msgId = startAssistantMessage(tab.id);
      try {
        await sendChatMessage(tab.id, trimmed);
      } catch (e) {
        appendAssistantText(tab.id, msgId, `**Error:** ${e}`);
        finalizeAssistantMessage(tab.id, msgId);
        setStreaming(tab.id, false);
      }
    }

    inputRef.current?.focus();
  }, [
    input,
    tab.id,
    initialMessage,
    addUserMessage,
    setStreaming,
    startAssistantMessage,
    appendAssistantText,
    finalizeAssistantMessage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = session?.messages ?? [];
  const isStreaming = session?.isStreaming ?? false;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Context badge */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {tab.context ?? activeContext ?? "no context"}
        </span>
        <span>/</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {tab.namespace ?? activeNamespace ?? "default"}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
              Send a message to start chatting with the AI assistant.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              {msg.role === "user" ? (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              ) : (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                  <Bot className="h-3.5 w-3.5 text-blue-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {msg.actionRequest ? (
                  <ChatActionCard
                    sessionId={tab.id}
                    action={msg.actionRequest}
                  />
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-foreground/60" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your cluster..."
            className="flex-1 resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
