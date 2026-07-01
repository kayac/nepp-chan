import { z } from "zod";

// Twilio ConversationRelay の WebSocket メッセージ。
// 仕様: https://www.twilio.com/docs/voice/conversationrelay/websocket-messages
// setup は多数のフィールドを含むため looseObject で未使用分も許容する。

const setupMessageSchema = z.looseObject({
  type: z.literal("setup"),
  sessionId: z.string(),
  callSid: z.string(),
  from: z.string(),
  to: z.string().optional(),
  direction: z.string().optional(),
  callType: z.string().optional(),
  customParameters: z.record(z.string(), z.string()).optional(),
});

const promptMessageSchema = z.looseObject({
  type: z.literal("prompt"),
  voicePrompt: z.string(),
  lang: z.string().optional(),
  last: z.boolean().optional(),
});

const interruptMessageSchema = z.looseObject({
  type: z.literal("interrupt"),
  utteranceUntilInterrupt: z.string().optional(),
  durationUntilInterruptMs: z.number().optional(),
});

const dtmfMessageSchema = z.looseObject({
  type: z.literal("dtmf"),
  digit: z.string(),
});

const errorMessageSchema = z.looseObject({
  type: z.literal("error"),
  description: z.string().optional(),
});

const inboundRelayMessageSchema = z.discriminatedUnion("type", [
  setupMessageSchema,
  promptMessageSchema,
  interruptMessageSchema,
  dtmfMessageSchema,
  errorMessageSchema,
]);

export type SetupMessage = z.infer<typeof setupMessageSchema>;
export type PromptMessage = z.infer<typeof promptMessageSchema>;
export type InterruptMessage = z.infer<typeof interruptMessageSchema>;
export type InboundRelayMessage = z.infer<typeof inboundRelayMessageSchema>;

export const parseRelayMessage = (raw: string) => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = inboundRelayMessageSchema.safeParse(json);
  if (!result.success) return null;
  return result.data;
};

export type TextTokenMessage = {
  type: "text";
  token: string;
  last: boolean;
  interruptible?: boolean;
  preemptible?: boolean;
  lang?: string;
};

export type TextTokenOptions = Pick<
  TextTokenMessage,
  "interruptible" | "preemptible" | "lang"
>;

export const textTokenMessage = (
  token: string,
  last = false,
  options: TextTokenOptions = {},
): TextTokenMessage => ({ type: "text", token, last, ...options });

export type PlayMessage = {
  type: "play";
  source: string;
  loop?: number;
  interruptible?: boolean;
  preemptible?: boolean;
};

type PlayOptions = Pick<PlayMessage, "loop" | "interruptible" | "preemptible">;

export const playMessage = (
  source: string,
  options: PlayOptions = {},
): PlayMessage => ({ type: "play", source, ...options });

export const serializeRelayMessage = (msg: TextTokenMessage | PlayMessage) =>
  JSON.stringify(msg);
