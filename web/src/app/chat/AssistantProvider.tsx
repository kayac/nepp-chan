import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import { ToolUIRegistry } from "~/components/assistant-ui/tool-uis";
import { API_BASE } from "~/lib/api/client";
import { getBearerToken } from "~/lib/auth-token";

export const GREETING_PROMPT =
  "新しい会話が始まりました。時間帯や季節に合った短い挨拶をしてください。";

export const ONBOARDING_PROMPT =
  "はじめてのユーザーとの会話です。自己紹介と、どのようなことができるか簡潔に説明してください。";

export const GREETING_PROMPTS = [GREETING_PROMPT, ONBOARDING_PROMPT];

interface Props {
  threadId: string;
  initialMessages?: UIMessage[];
  greetingPrompt?: string;
  children: ReactNode;
}

export const AssistantProvider = ({
  threadId,
  initialMessages,
  greetingPrompt,
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
            const intent = GREETING_PROMPTS.includes(lastText ?? "")
              ? "casual"
              : undefined;
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
    if (!greetingPrompt || sent.current) return;
    sent.current = true;
    runtime.thread.append(greetingPrompt);
  }, [runtime, greetingPrompt]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ToolUIRegistry />
      {children}
    </AssistantRuntimeProvider>
  );
};
