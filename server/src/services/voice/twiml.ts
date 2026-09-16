type InterruptionKind = "none" | "dtmf" | "speech" | "any";

type ConversationRelayConfig = {
  wsUrl: string;
  welcomeGreeting?: string;
  welcomeGreetingInterruptible?: InterruptionKind;
  language?: string;
  ttsLanguage?: string;
  transcriptionLanguage?: string;
  ttsProvider?: string;
  voice?: string;
  transcriptionProvider?: string;
  speechModel?: string;
  speechTimeout?: string;
  eotThreshold?: string;
  hints?: string;
  interruptible?: InterruptionKind;
  interruptSensitivity?: "high" | "medium" | "low";
  reportInputDuringAgentSpeech?: InterruptionKind;
  elevenlabsTextNormalization?: "on" | "auto" | "off";
  debug?: string;
  partialPrompts?: boolean;
  deepgramSmartFormat?: boolean;
  dtmfDetection?: boolean;
  ignoreBackchannel?: boolean;
  preemptible?: boolean;
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
  value === undefined ? "" : ` ${name}="${escapeXmlAttr(value)}"`;

const boolAttr = (name: string, value: boolean | undefined) =>
  value === undefined ? "" : ` ${name}="${value}"`;

const parameterTags = (parameters: Record<string, string> | undefined) =>
  Object.entries(parameters ?? {})
    .map(
      ([name, value]) =>
        `<Parameter name="${escapeXmlAttr(name)}" value="${escapeXmlAttr(value)}"/>`,
    )
    .join("");

const connectTwiml = (
  tag: string,
  attrs: string,
  params: string,
  before = "",
) => {
  const element = params
    ? `<${tag}${attrs}>${params}</${tag}>`
    : `<${tag}${attrs}/>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${before}<Connect>${element}</Connect></Response>`;
};

export const buildConversationRelayTwiml = ({
  wsUrl,
  welcomeGreeting,
  welcomeGreetingInterruptible,
  language = "ja-JP",
  ttsLanguage,
  transcriptionLanguage,
  ttsProvider,
  voice,
  transcriptionProvider,
  speechModel,
  speechTimeout,
  eotThreshold,
  hints,
  interruptible,
  interruptSensitivity,
  reportInputDuringAgentSpeech,
  elevenlabsTextNormalization,
  debug,
  partialPrompts,
  deepgramSmartFormat,
  dtmfDetection,
  ignoreBackchannel,
  preemptible,
  parameters,
}: ConversationRelayConfig) => {
  const attrs = [
    attr("url", wsUrl),
    attr("welcomeGreeting", welcomeGreeting),
    attr("welcomeGreetingInterruptible", welcomeGreetingInterruptible),
    attr("language", language),
    attr("ttsLanguage", ttsLanguage),
    attr("transcriptionLanguage", transcriptionLanguage),
    attr("ttsProvider", ttsProvider),
    attr("voice", voice),
    attr("transcriptionProvider", transcriptionProvider),
    attr("speechModel", speechModel),
    attr("speechTimeout", speechTimeout),
    attr("eotThreshold", eotThreshold),
    attr("hints", hints),
    attr("interruptible", interruptible),
    attr("interruptSensitivity", interruptSensitivity),
    attr("reportInputDuringAgentSpeech", reportInputDuringAgentSpeech),
    attr("elevenlabsTextNormalization", elevenlabsTextNormalization),
    attr("debug", debug),
    boolAttr("partialPrompts", partialPrompts),
    boolAttr("deepgramSmartFormat", deepgramSmartFormat),
    boolAttr("dtmfDetection", dtmfDetection),
    boolAttr("ignoreBackchannel", ignoreBackchannel),
    boolAttr("preemptible", preemptible),
  ].join("");

  return connectTwiml("ConversationRelay", attrs, parameterTags(parameters));
};

type MediaStreamConfig = {
  wsUrl: string;
  connectTone?: string;
  parameters?: Record<string, string>;
};

export const buildMediaStreamTwiml = ({
  wsUrl,
  connectTone,
  parameters,
}: MediaStreamConfig) =>
  connectTwiml(
    "Stream",
    attr("url", wsUrl),
    parameterTags(parameters),
    connectTone ? `<Play${attr("digits", connectTone)}/>` : "",
  );
