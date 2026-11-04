import { z } from "zod";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { saveVoiceTurns } from "../persist-turns";
import { pairTranscriptTurns, type TranscriptEntry } from "./transcript";

const transcriptionEventSchema = z.object({
  type: z.literal("post_call_transcription"),
  data: z.object({
    conversation_id: z.string(),
    transcript: z.array(
      z.object({ role: z.string(), message: z.string().nullable().optional() }),
    ),
    metadata: z
      .object({
        start_time_unix_secs: z.number().optional(),
        call_duration_secs: z.number().optional(),
        cost: z.number().optional(),
      })
      .optional(),
    conversation_initiation_client_data: z
      .object({
        dynamic_variables: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  }),
});

const UNKNOWN_CALLER = "unknown";

const callerOf = (vars: Record<string, unknown> | undefined) => {
  const caller = vars?.system__caller_id;
  return typeof caller === "string" && caller ? caller : UNKNOWN_CALLER;
};

const isTranscriptEntry = (e: { role: string }): e is TranscriptEntry =>
  e.role === "user" || e.role === "agent";

export const handlePostCallEvent = async ({
  env,
  event,
}: {
  env: CloudflareBindings;
  event: unknown;
}) => {
  const parsed = transcriptionEventSchema.safeParse(event);
  if (!parsed.success) {
    return { outcome: "ignored" as const };
  }
  const { data } = parsed.data;
  const caller = callerOf(
    data.conversation_initiation_client_data?.dynamic_variables,
  );
  const { resourceId, threadId } = await toVoiceIds(
    caller,
    data.conversation_id,
    env.RESOURCE_ID_HASH_SECRET,
  );
  const turns = pairTranscriptTurns(
    data.transcript.filter(isTranscriptEntry),
  ).map((turn, turnIndex) => ({ turnIndex, ...turn }));
  const startedAt = data.metadata?.start_time_unix_secs;
  const createdAt = startedAt ? new Date(startedAt * 1000) : new Date();

  logger.info("[Voice][EL] post-call", {
    conversationId: data.conversation_id,
    hasCaller: caller !== UNKNOWN_CALLER,
    turns: turns.length,
    durationSecs: data.metadata?.call_duration_secs ?? -1,
    cost: data.metadata?.cost ?? -1,
  });

  if (turns.length > 0) {
    await saveVoiceTurns({
      db: env.DB,
      threadId,
      resourceId,
      createdAt,
      turns,
    });
  }
  return { outcome: "saved" as const, turns: turns.length };
};
