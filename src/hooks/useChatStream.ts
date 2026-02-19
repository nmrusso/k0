import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startChatSession, stopChatSession } from "@/lib/tauri-commands";
import { useChatStore, type ActionRequest } from "@/stores/chatStore";

interface ChatEventPayload {
  type: string; // "text" | "action_request" | "error" | "thinking" | "message_end"
  content?: string;
  action?: ActionRequest;
}

export function useChatStream(
  sessionId: string,
  initialMessage: string | null,
  contextInfo?: string,
  activeResource?: string,
  resourceContext?: string,
) {
  const getOrCreateSession = useChatStore((s) => s.getOrCreateSession);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendAssistantText = useChatStore((s) => s.appendAssistantText);
  const finalizeAssistantMessage = useChatStore((s) => s.finalizeAssistantMessage);
  const addActionRequest = useChatStore((s) => s.addActionRequest);
  const setStreaming = useChatStore((s) => s.setStreaming);

  // Track the current assistant message ID
  const currentMsgId = useRef<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    getOrCreateSession(sessionId);
  }, [sessionId, getOrCreateSession]);

  useEffect(() => {
    if (!initialMessage || initialized.current) return;
    initialized.current = true;

    let unlistenEvent: (() => void) | null = null;
    let unlistenEnd: (() => void) | null = null;
    let cancelled = false;

    async function setup() {
      // Listen for chat events BEFORE starting the session
      unlistenEvent = await listen<ChatEventPayload>(
        `chat-event-${sessionId}`,
        (event) => {
          if (cancelled) return;
          const payload = event.payload;

          switch (payload.type) {
            case "text": {
              if (!currentMsgId.current) {
                currentMsgId.current = startAssistantMessage(sessionId);
              }
              if (payload.content) {
                appendAssistantText(sessionId, currentMsgId.current, payload.content);
              }
              break;
            }
            case "thinking": {
              if (!currentMsgId.current) {
                currentMsgId.current = startAssistantMessage(sessionId);
              }
              break;
            }
            case "action_request": {
              if (payload.action) {
                // Finalize current text message if any
                if (currentMsgId.current) {
                  finalizeAssistantMessage(sessionId, currentMsgId.current);
                  currentMsgId.current = null;
                }
                addActionRequest(sessionId, {
                  ...payload.action,
                  status: "pending",
                });
              }
              break;
            }
            case "message_end": {
              if (currentMsgId.current) {
                finalizeAssistantMessage(sessionId, currentMsgId.current);
                currentMsgId.current = null;
              }
              setStreaming(sessionId, false);
              break;
            }
            case "error": {
              if (!currentMsgId.current) {
                currentMsgId.current = startAssistantMessage(sessionId);
              }
              if (payload.content) {
                appendAssistantText(
                  sessionId,
                  currentMsgId.current,
                  `\n\n**Error:** ${payload.content}`,
                );
              }
              break;
            }
          }
        },
      );

      unlistenEnd = await listen(`chat-ended-${sessionId}`, () => {
        if (cancelled) return;
        if (currentMsgId.current) {
          finalizeAssistantMessage(sessionId, currentMsgId.current);
          currentMsgId.current = null;
        }
        setStreaming(sessionId, false);
      });

      if (cancelled) {
        unlistenEvent?.();
        unlistenEnd?.();
        return;
      }

      // Mark as streaming before starting so the thinking indicator shows
      setStreaming(sessionId, true);

      // Start the chat session
      try {
        await startChatSession(sessionId, initialMessage!, contextInfo, activeResource, resourceContext);
      } catch (e) {
        if (!cancelled) {
          const msgId = startAssistantMessage(sessionId);
          appendAssistantText(sessionId, msgId, `**Error starting chat:** ${e}`);
          finalizeAssistantMessage(sessionId, msgId);
          setStreaming(sessionId, false);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlistenEvent?.();
      unlistenEnd?.();
      stopChatSession(sessionId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, initialMessage]);
}
