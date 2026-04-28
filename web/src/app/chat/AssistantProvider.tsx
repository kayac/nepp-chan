import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import { ToolUIRegistry } from "~/components/assistant-ui/tool-uis";
import { API_BASE } from "~/lib/api/client";
import { getBearerToken } from "~/lib/auth-token";

/** 既存スレッドの再開時に system 役で送る挨拶要求プロンプト */
export const GREETING_PROMPT =
  "新しい会話が始まりました。時間帯や季節に合った短い挨拶をしてください。";

/** マウント時に append する最初のメッセージ */
export type InitialMessage =
  | { type: "greeting" }
  | { type: "user"; text: string };

interface Props {
  threadId: string;
  initialMessages?: UIMessage[];
  initialMessage?: InitialMessage;
  children: ReactNode;
}

export const AssistantProvider = ({
  threadId,
  initialMessages,
  initialMessage,
  children,
}: Props) => {
  const runtime = useChatRuntime({
    messages: initialMessages,
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: `${API_BASE}/threads/${threadId}/chat`,
          headers: (): Record<string, string> => {
            const token = getBearerToken();
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
            return {};
          },
          prepareSendMessagesRequest({ messages }) {
            const lastMessage = messages[messages.length - 1];
            const lastText = lastMessage?.parts
              ?.filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("");
            const intent = lastText === GREETING_PROMPT ? "casual" : undefined;
            return {
              body: {
                message: lastMessage,
                intent,
              },
            };
          },
        }),
      [threadId],
    ),
  });

  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !initialMessage) return;
    sent.current = true;
    const text =
      initialMessage.type === "greeting"
        ? GREETING_PROMPT
        : initialMessage.text;
    runtime.thread.append(text);
  }, [runtime, initialMessage]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ToolUIRegistry />
      {children}
    </AssistantRuntimeProvider>
  );
};
