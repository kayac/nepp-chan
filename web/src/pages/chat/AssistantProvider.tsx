import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { ToolUIRegistry } from "~/components/assistant-ui/tool-uis";
import { API_BASE } from "~/lib/api/client";
import { getResourceId } from "~/lib/resource";

interface Props {
  threadId: string;
  children: ReactNode;
}

export const AssistantProvider = ({ threadId, children }: Props) => {
  const resourceId = useMemo(() => getResourceId(), []);

  const runtime = useChatRuntime({
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: `${API_BASE}/chat`,
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
