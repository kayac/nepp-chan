type ConversationRelayConfig = {
  wsUrl: string;
  welcomeGreeting?: string;
  language?: string;
  ttsProvider?: string;
  voice?: string;
  transcriptionProvider?: string;
  interruptible?: "none" | "dtmf" | "speech" | "any";
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
  interruptible,
}: ConversationRelayConfig) => {
  const attrs = [
    attr("url", wsUrl),
    attr("welcomeGreeting", welcomeGreeting),
    attr("language", language),
    attr("ttsProvider", ttsProvider),
    attr("voice", voice),
    attr("transcriptionProvider", transcriptionProvider),
    attr("interruptible", interruptible),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay${attrs}/></Connect></Response>`;
};
