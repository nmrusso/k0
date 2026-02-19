import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Loader2, User, Bot, X } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useChatStream } from "@/hooks/useChatStream";
import { useChatDrawerStore } from "@/stores/chatDrawerStore";
import { useClusterStore } from "@/stores/clusterStore";
import { sendChatMessage, stopChatSession } from "@/lib/tauri-commands";
import { ChatActionCard } from "@/components/panel/ChatActionCard";

export function ChatDrawer() {
  const isOpen = useChatDrawerStore((s) => s.isOpen);
  const sessionId = useChatDrawerStore((s) => s.sessionId);
  const resourceKind = useChatDrawerStore((s) => s.resourceKind);
  const resourceName = useChatDrawerStore((s) => s.resourceName);
  const resourceContext = useChatDrawerStore((s) => s.resourceContext);
  const closeDrawer = useChatDrawerStore((s) => s.closeDrawer);

  if (!isOpen || !sessionId) return null;

  return (
    <ChatDrawerContent
      key={sessionId}
      sessionId={sessionId}
      resourceKind={resourceKind!}
      resourceName={resourceName!}
      resourceContext={resourceContext!}
      onClose={() => {
        stopChatSession(sessionId).catch(() => {});
        closeDrawer();
      }}
    />
  );
}

function ChatDrawerContent({
  sessionId,
  resourceKind,
  resourceName,
  resourceContext,
  onClose,
}: {
  sessionId: string;
  resourceKind: string;
  resourceName: string;
  resourceContext: string;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const session = useChatStore((s) => s.sessions[sessionId]);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendAssistantText = useChatStore((s) => s.appendAssistantText);
  const finalizeAssistantMessage = useChatStore((s) => s.finalizeAssistantMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);

  useChatStream(
    sessionId,
    initialMessage,
    activeContext ?? undefined,
    `${resourceKind}/${resourceName}`,
    resourceContext,
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    addUserMessage(sessionId, trimmed);
    setInput("");

    if (!initialMessage) {
      setStreaming(sessionId, true);
      setInitialMessage(trimmed);
    } else {
      setStreaming(sessionId, true);
      const msgId = startAssistantMessage(sessionId);
      try {
        await sendChatMessage(sessionId, trimmed);
      } catch (e) {
        appendAssistantText(sessionId, msgId, `**Error:** ${e}`);
        finalizeAssistantMessage(sessionId, msgId);
        setStreaming(sessionId, false);
      }
    }

    inputRef.current?.focus();
  }, [
    input,
    sessionId,
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
  const waitingForResponse =
    isStreaming && (messages.length === 0 || messages[messages.length - 1]?.role === "user");

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-col border-t border-border bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" style={{ height: 300 }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 shrink-0">
        <Bot className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-medium">Ask Claude</span>
        <span className="truncate text-xs text-muted-foreground font-mono">
          {resourceKind}/{resourceName}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {activeContext ?? ""}
          {activeNamespace ? ` / ${activeNamespace}` : ""}
        </span>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="flex flex-col gap-2 p-3">
          {messages.length === 0 && !waitingForResponse && (
            <div className="flex items-center justify-center gap-1 py-4 text-xs text-muted-foreground">
              Context loaded for{" "}
              <span className="font-mono text-foreground">
                {resourceKind}/{resourceName}
              </span>
              — ask a question.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              {msg.role === "user" ? (
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3 w-3 text-primary" />
                </div>
              ) : (
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                  <Bot className="h-3 w-3 text-blue-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {msg.actionRequest ? (
                  <ChatActionCard sessionId={sessionId} action={msg.actionRequest} />
                ) : (
                  <div className="text-xs whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-foreground/60" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Thinking indicator */}
          {waitingForResponse && (
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Bot className="h-3 w-3 text-blue-500" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-3 py-2 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this resource..."
            className="flex-1 resize-none rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
