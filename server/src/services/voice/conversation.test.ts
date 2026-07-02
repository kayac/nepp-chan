import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { runVoiceTurn } from "./conversation";

type FakeChunk =
  | { type: "text-delta"; payload: { text: string } }
  | { type: "tool-call"; payload: { toolName: string } }
  | { type: "tool-result"; payload: Record<string, unknown> };

const textDelta = (text: string): FakeChunk => ({
  type: "text-delta",
  payload: { text },
});
const toolCall = (toolName: string): FakeChunk => ({
  type: "tool-call",
  payload: { toolName },
});

async function* fakeFullStream(chunks: FakeChunk[]) {
  for (const chunk of chunks) yield chunk;
}

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));
vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(() => ({})),
}));
vi.mock("@mastra/core/mastra", () => ({
  Mastra: class {
    getAgent() {
      return { stream: streamMock };
    }
  },
}));

describe("runVoiceTurn", () => {
  const env = {
    DB: {},
    RESOURCE_ID_HASH_SECRET: "test-secret",
  } as unknown as CloudflareBindings;

  beforeEach(() => {
    streamMock.mockReset();
  });

  it("toVoiceIds 由来の memory を渡して text-delta を順に yield する", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([textDelta("こん"), textDelta("にちは")]),
    });

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:tester",
      text: "やあ",
    })) {
      out.push(d);
    }

    expect(out).toEqual(["こん", "にちは"]);
    const ids = await toVoiceIds("client:tester", "test-secret");
    expect(streamMock).toHaveBeenCalledWith(
      "やあ",
      expect.objectContaining({
        memory: { resource: ids.resourceId, thread: ids.threadId },
      }),
    );
  });

  it("delta から絵文字を除去して返す（TTS は絵文字を読めない）", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([
        textDelta("おはよう"),
        textDelta("🌸"),
        textDelta("いい天気だね😊"),
      ]),
    });

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:tester",
      text: "おはよう",
    })) {
      out.push(d);
    }

    expect(out).toEqual(["おはよう", "いい天気だね"]);
  });

  it("knowledge/web のサブエージェント tool-call で onToolCall を呼ぶ（保留音）", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([
        textDelta("調べてみるね"),
        toolCall("agent-knowledgeAgent"),
        textDelta("音威子府そばだよ"),
      ]),
    });
    const onToolCall = vi.fn();

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:x",
      text: "観光スポット教えて",
      onToolCall,
    })) {
      out.push(d);
    }

    expect(out).toEqual(["調べてみるね", "音威子府そばだよ"]);
    expect(onToolCall).toHaveBeenCalledTimes(1);
  });

  it("検索以外の tool-call（updateWorkingMemory）では onToolCall を呼ばない", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([
        toolCall("updateWorkingMemory"),
        textDelta("はーい"),
      ]),
    });
    const onToolCall = vi.fn();

    for await (const _ of runVoiceTurn({
      env,
      from: "client:x",
      text: "やあ",
      onToolCall,
    })) {
      // drain
    }

    expect(onToolCall).not.toHaveBeenCalled();
  });

  it("ターン完了時に llm timing を1回記録する（intent 分類なし）", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([textDelta("こん"), textDelta("にちは")]),
    });
    const infoSpy = vi.spyOn(logger, "info");

    for await (const _ of runVoiceTurn({
      env,
      from: "client:tester",
      text: "やあ",
    })) {
      // drain
    }

    const timingCalls = infoSpy.mock.calls.filter(
      ([msg]) => msg === "[Voice] llm timing",
    );
    expect(timingCalls).toHaveLength(1);
    expect(timingCalls[0][1]).toHaveProperty("streamReadyMs");
    expect(timingCalls[0][1]).toHaveProperty("firstTokenMs");
    expect(timingCalls[0][1]).not.toHaveProperty("intent");

    infoSpy.mockRestore();
  });

  it("signal を agent.stream に渡し、中断で停止する", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([
        textDelta("a"),
        textDelta("b"),
        textDelta("c"),
      ]),
    });
    const controller = new AbortController();

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:x",
      text: "hi",
      signal: controller.signal,
    })) {
      out.push(d);
      if (d === "a") controller.abort();
    }

    expect(out).toEqual(["a"]);
    expect(streamMock).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({ abortSignal: controller.signal }),
    );
    const { requestContext } = streamMock.mock.calls[0][1];
    expect(requestContext.get("voiceTurnSignal")).toBe(controller.signal);
  });
});
