import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { ToolUIRegistry } from "~/components/assistant-ui/tool-uis";
import { API_BASE } from "~/lib/api/client";
import { getAuthToken } from "~/lib/auth-token";
import { getResourceId } from "~/lib/resource";

interface Props {
  threadId: string;
  initialMessages?: UIMessage[];
  children: ReactNode;
}

export const AssistantProvider = ({
  threadId,
  initialMessages,
  children,
}: Props) => {
  const resourceId = useMemo(() => getResourceId(), []);

  const runtime = useChatRuntime({
    messages: initialMessages,
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: `${API_BASE}/chat`,
          headers: (): Record<string, string> => {
            const token = getAuthToken();
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
            return {};
          },
          prepareSendMessagesRequest({ messages }) {
            const lastMessage = messages[messages.length - 1];
            return {
              body: {
                message: lastMessage,
                resourceId,
                threadId,
              },
            };
          },
        }),
      [resourceId, threadId],
    ),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ToolUIRegistry />
      {children}
    </AssistantRuntimeProvider>
  );
};
