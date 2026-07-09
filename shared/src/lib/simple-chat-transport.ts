import type { SimpleChatRequest } from "@nepp-chan/shared/api";
import { DefaultChatTransport } from "ai";

type Options = {
  apiUrl: string;
  historyLimit: number;
};

export const createSimpleChatTransport = ({ apiUrl, historyLimit }: Options) =>
  new DefaultChatTransport({
    api: `${apiUrl}/simple-chat`,
    prepareSendMessagesRequest({ messages }) {
      const body: SimpleChatRequest = {
        messages: messages.slice(
          -Math.max(1, historyLimit),
        ) as SimpleChatRequest["messages"],
      };
      return { body };
    },
  });
