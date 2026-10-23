import { z } from "zod";

// Twilio Media Streams の判別キーは type ではなく event。
// 仕様: https://www.twilio.com/docs/voice/media-streams/websocket-messages
const connectedEventSchema = z.looseObject({
  event: z.literal("connected"),
});

const startEventSchema = z.looseObject({
  event: z.literal("start"),
  streamSid: z.string(),
  start: z.looseObject({
    streamSid: z.string(),
    callSid: z.string(),
    customParameters: z.record(z.string(), z.string()).optional(),
  }),
});

const mediaEventSchema = z.looseObject({
  event: z.literal("media"),
  media: z.looseObject({
    payload: z.string(),
    track: z.string().optional(),
  }),
});

const stopEventSchema = z.looseObject({
  event: z.literal("stop"),
});

const inboundStreamEventSchema = z.discriminatedUnion("event", [
  connectedEventSchema,
  startEventSchema,
  mediaEventSchema,
  stopEventSchema,
]);

export const parseStreamEvent = (raw: string) => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = inboundStreamEventSchema.safeParse(json);
  return result.success ? result.data : null;
};

type StreamMediaMessage = {
  event: "media";
  streamSid: string;
  media: { payload: string };
};

export const streamMediaMessage = (
  streamSid: string,
  payload: string,
): StreamMediaMessage => ({
  event: "media",
  streamSid,
  media: { payload },
});

export const serializeStreamMessage = (msg: StreamMediaMessage) =>
  JSON.stringify(msg);

// 仕様: https://developers.openai.com/api/docs/guides/voice-websockets?api=live
const sessionStartedSchema = z.looseObject({
  type: z.literal("session.started"),
});

const outputAudioDeltaSchema = z.looseObject({
  type: z.literal("session.output_audio.delta"),
  delta: z.string(),
});

const inputTranscriptDeltaSchema = z.looseObject({
  type: z.literal("session.input_transcript.delta"),
  delta: z.string(),
  start_ms: z.number().optional(),
  end_ms: z.number().optional(),
});

const outputTranscriptDeltaSchema = z.looseObject({
  type: z.literal("session.output_transcript.delta"),
  delta: z.string(),
  start_ms: z.number().optional(),
  end_ms: z.number().optional(),
});

const delegationCreatedSchema = z.looseObject({
  type: z.literal("session.delegation.created"),
  offset_ms: z.number().optional(),
  delegation: z.looseObject({
    id: z.string(),
    target: z.string().optional(),
  }),
});

const sessionClosedSchema = z.looseObject({
  type: z.literal("session.closed"),
  reason: z.string().optional(),
  usage: z.unknown().optional(),
});

const usageUpdatedSchema = z.looseObject({
  type: z.literal("session.usage.updated"),
  usage: z.unknown().optional(),
  context_window: z.unknown().optional(),
});

const appendedSchema = z.looseObject({
  type: z.enum([
    "session.instructions.appended",
    "session.thinking.appended",
    "session.commentary.appended",
  ]),
  client_event_id: z.string().optional(),
  start_ms: z.number().optional(),
  end_ms: z.number().optional(),
});

const liveErrorSchema = z.looseObject({
  type: z.literal("error"),
});

const inboundLiveEventSchema = z.discriminatedUnion("type", [
  sessionStartedSchema,
  outputAudioDeltaSchema,
  inputTranscriptDeltaSchema,
  outputTranscriptDeltaSchema,
  delegationCreatedSchema,
  sessionClosedSchema,
  usageUpdatedSchema,
  appendedSchema,
  liveErrorSchema,
]);

export const parseLiveEvent = (raw: string) => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = inboundLiveEventSchema.safeParse(json);
  return result.success ? result.data : null;
};

const LIVE_AUDIO_FORMAT = {
  type: "audio/pcmu",
  rate: 8000,
} as const;

type SessionStartOptions = {
  model: string;
  instructions: string;
  voice: string;
  eventId: string;
};

type SessionStartMessage = {
  type: "session.start";
  event_id: string;
  session: {
    model: string;
    instructions: string;
    audio: {
      format: typeof LIVE_AUDIO_FORMAT;
      output: { voice: string };
    };
    delegation: { type: "client" };
  };
};

export const sessionStartMessage = ({
  model,
  instructions,
  voice,
  eventId,
}: SessionStartOptions): SessionStartMessage => ({
  type: "session.start",
  event_id: eventId,
  session: {
    model,
    instructions,
    audio: {
      format: LIVE_AUDIO_FORMAT,
      output: { voice },
    },
    delegation: { type: "client" },
  },
});

type InputAudioAppendMessage = {
  type: "session.input_audio.append";
  audio: string;
};

export const inputAudioAppendMessage = (
  audio: string,
): InputAudioAppendMessage => ({
  type: "session.input_audio.append",
  audio,
});

// delegation_id は必須で null 許容。省略すると missing_required_parameter になる。
type AppendMessage = {
  type: "session.commentary.append" | "session.instructions.append";
  event_id: string;
  delegation_id: string | null;
  content: string;
};

export const commentaryAppendMessage = (
  eventId: string,
  content: string,
  delegationId: string | null = null,
): AppendMessage => ({
  type: "session.commentary.append",
  event_id: eventId,
  delegation_id: delegationId,
  content,
});

export const instructionsAppendMessage = (
  eventId: string,
  content: string,
  delegationId: string | null = null,
): AppendMessage => ({
  type: "session.instructions.append",
  event_id: eventId,
  delegation_id: delegationId,
  content,
});

type SessionCloseMessage = { type: "session.close"; event_id: string };

export const sessionCloseMessage = (eventId: string): SessionCloseMessage => ({
  type: "session.close",
  event_id: eventId,
});

export const serializeLiveMessage = (
  msg:
    | SessionStartMessage
    | InputAudioAppendMessage
    | AppendMessage
    | SessionCloseMessage,
) => JSON.stringify(msg);
