type ConversationRelayConfig = {
  wsUrl: string;
  welcomeGreeting?: string;
  language?: string;
  ttsProvider?: string;
  voice?: string;
  transcriptionProvider?: string;
  speechModel?: string;
  speechTimeout?: string;
  hints?: string;
  interruptible?: "none" | "dtmf" | "speech" | "any";
  // WS の url はクエリ文字列を保持しない可能性があるため、認証トークン等は
  // <Parameter> 経由で setup メッセージの customParameters に渡す。
  parameters?: Record<string, string>;
};

const escapeXmlAttr = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const attr = (name: string, value: string | undefined) =>
  value ? ` ${name}="${escapeXmlAttr(value)}"` : "";

export const buildConversationRelayTwiml = ({
  wsUrl,
  welcomeGreeting,
  language = "ja-JP",
  ttsProvider,
  voice,
  transcriptionProvider,
  speechModel,
  speechTimeout,
  hints,
  interruptible,
  parameters,
}: ConversationRelayConfig) => {
  const attrs = [
    attr("url", wsUrl),
    attr("welcomeGreeting", welcomeGreeting),
    attr("language", language),
    attr("ttsProvider", ttsProvider),
    attr("voice", voice),
    attr("transcriptionProvider", transcriptionProvider),
    attr("speechModel", speechModel),
    attr("speechTimeout", speechTimeout),
    attr("hints", hints),
    attr("interruptible", interruptible),
  ].join("");

  const params = Object.entries(parameters ?? {})
    .map(
      ([name, value]) =>
        `<Parameter name="${escapeXmlAttr(name)}" value="${escapeXmlAttr(value)}"/>`,
    )
    .join("");

  const relay = params
    ? `<ConversationRelay${attrs}>${params}</ConversationRelay>`
    : `<ConversationRelay${attrs}/>`;

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect>${relay}</Connect></Response>`;
};
