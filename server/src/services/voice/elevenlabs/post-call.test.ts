import { beforeEach, describe, expect, it, vi } from "vitest";
import { toVoiceIds } from "~/lib/principal";

const { saveVoiceTurnsMock } = vi.hoisted(() => ({
  saveVoiceTurnsMock: vi.fn(),
}));

vi.mock("../persist-turns", () => ({ saveVoiceTurns: saveVoiceTurnsMock }));

const { handlePostCallEvent } = await import("./post-call");

const SECRET = "secret";
const env = {
  DB: {} as D1Database,
  RESOURCE_ID_HASH_SECRET: SECRET,
} as unknown as CloudflareBindings;

const transcript = [
  { role: "user", message: "こんにちは" },
  { role: "agent", message: "やあ" },
];

const transcription = (data: Record<string, unknown>) => ({
  type: "post_call_transcription",
  event_timestamp: 1_800_000_000,
  data: { conversation_id: "conv_1", transcript, ...data },
});

const savedArgs = () => saveVoiceTurnsMock.mock.calls[0][0];

beforeEach(() => {
  saveVoiceTurnsMock.mockReset();
});

describe("handlePostCallEvent", () => {
  it("post_call_transcription 以外のイベントは何も保存せず ignored を返す", async () => {
    const result = await handlePostCallEvent({
      env,
      event: { type: "post_call_audio", data: { conversation_id: "conv_1" } },
    });
    expect(result).toEqual({ outcome: "ignored" });
    expect(saveVoiceTurnsMock).not.toHaveBeenCalled();
  });

  it("system__caller_id を resourceId にし、conversation_id を threadId にする", async () => {
    await handlePostCallEvent({
      env,
      event: transcription({
        conversation_initiation_client_data: {
          dynamic_variables: { system__caller_id: "+81900000000" },
        },
      }),
    });
    const expected = await toVoiceIds("+81900000000", "conv_1", SECRET);
    expect(savedArgs()).toMatchObject({
      resourceId: expected.resourceId,
      threadId: expected.threadId,
      turns: [{ turnIndex: 0, userText: "こんにちは", assistantText: "やあ" }],
    });
  });

  it("クライアントが渡した caller_number は通話者の識別に使わない", async () => {
    await handlePostCallEvent({
      env,
      event: transcription({
        conversation_initiation_client_data: {
          dynamic_variables: { caller_number: "+81901234567" },
        },
      }),
    });
    const expected = await toVoiceIds("unknown", "conv_1", SECRET);
    expect(savedArgs().resourceId).toBe(expected.resourceId);
  });

  it("通話者が分からなければ unknown の resourceId で保存する", async () => {
    await handlePostCallEvent({ env, event: transcription({}) });
    const expected = await toVoiceIds("unknown", "conv_1", SECRET);
    expect(savedArgs().resourceId).toBe(expected.resourceId);
  });

  it("start_time_unix_secs があればスレッドの createdAt にする", async () => {
    await handlePostCallEvent({
      env,
      event: transcription({
        metadata: { start_time_unix_secs: 1_800_000_000 },
      }),
    });
    expect(savedArgs().createdAt).toEqual(new Date(1_800_000_000_000));
  });

  it("ペアにできるターンが無ければ保存しない", async () => {
    const result = await handlePostCallEvent({
      env,
      event: transcription({
        transcript: [{ role: "agent", message: "もしもし" }],
      }),
    });
    expect(result).toEqual({ outcome: "saved", turns: 0 });
    expect(saveVoiceTurnsMock).not.toHaveBeenCalled();
  });
});
