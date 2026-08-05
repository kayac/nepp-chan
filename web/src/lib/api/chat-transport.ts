import { DefaultChatTransport, type UIMessage } from "ai";

import { API_BASE } from "~/lib/api/client";
import { getBearerToken } from "~/lib/auth-token";

type ResolveIntent = (
  lastMessage: UIMessage | undefined,
) => "casual" | "thinking" | undefined;

export const createThreadChatTransport = (
  threadId: string,
  options: { resolveIntent?: ResolveIntent } = {},
) =>
  new DefaultChatTransport({
    api: `${API_BASE}/threads/${threadId}/chat`,
    headers: (): Record<string, string> => {
      const token = getBearerToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    prepareSendMessagesRequest({ messages }) {
      const lastMessage = messages[messages.length - 1];
      return {
        body: {
          message: lastMessage,
          intent: options.resolveIntent?.(lastMessage),
        },
      };
    },
  });
