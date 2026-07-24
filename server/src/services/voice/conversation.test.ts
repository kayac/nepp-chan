import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/lib/logger";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createVoiceConversation } from "./conversation";

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

const { getMemoryStoreMock, saveMessagesMock, saveThreadMock, streamMock } =
  vi.hoisted(() => ({
    getMemoryStoreMock: vi.fn(),
    saveMessagesMock: vi.fn(),
    saveThreadMock: vi.fn(),
    streamMock: vi.fn(),
  }));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({ getStore: getMemoryStoreMock }),
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

describe("createVoiceConversation", () => {
  const env = {
    DB: {},
    RESOURCE_ID_HASH_SECRET: "test-secret",
  } as unknown as CloudflareBindings;

  beforeEach(() => {
    streamMock.mockReset();
    getMemoryStoreMock.mockReset();
    getMemoryStoreMock.mockResolvedValue({
      saveMessages: saveMessagesMock,
      saveThread: saveThreadMock,
    });
    saveMessagesMock.mockReset();
    saveThreadMock.mockReset();
  });

  it("Mastra Memory を使わず、通話内の履歴を明示して text-delta を返す", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([textDelta("こん"), textDelta("にちは")]),
    });

    const conversation = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });
    const out: string[] = [];
    for await (const d of conversation.runTurn({ text: "やあ" })) {
      out.push(d);
    }

    expect(out).toEqual(["こん", "にちは"]);
    expect(streamMock).toHaveBeenCalledWith(
      [{ role: "user", content: "やあ" }],
      expect.not.objectContaining({ memory: expect.anything() }),
    );
    expect(createNeppChanAgent).toHaveBeenCalledWith(
      expect.objectContaining({ withMemory: false }),
    );

    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([textDelta("元気だよ")]),
    });
    for await (const _ of conversation.runTurn({ text: "元気？" })) {
      // drain
    }
    expect(streamMock).toHaveBeenLastCalledWith(
      [
        { role: "user", content: "やあ" },
        { role: "assistant", content: "こんにちは" },
        { role: "user", content: "元気？" },
      ],
      expect.anything(),
    );
  });

  it("応答完了後に同じ ID でスレッドと1ターンを upsert する", async () => {
    const conversation = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });

    await conversation.persistTurn({
      turnIndex: 0,
      userText: "やあ",
      assistantText: "こんにちは",
    });

    expect(saveThreadMock).toHaveBeenCalledWith({
      thread: expect.objectContaining({
        id: expect.stringMatching(/^voice-thread:/),
        resourceId: expect.stringMatching(/^voice:/),
        title: "音声通話",
      }),
    });
    expect(saveMessagesMock).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({
          id: expect.stringContaining(":turn:0:user"),
          role: "user",
        }),
        expect.objectContaining({
          id: expect.stringContaining(":turn:0:assistant"),
          role: "assistant",
        }),
      ],
    });
    const [userMessage, assistantMessage] =
      saveMessagesMock.mock.calls[0][0].messages;
    expect(userMessage.createdAt.getTime()).toBeLessThan(
      assistantMessage.createdAt.getTime(),
    );
  });

  it("読み上げ可能な応答が空なら、そのターンを履歴へ追加しない", async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: fakeFullStream([textDelta("🌸")]),
    });
    const conversation = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });
    for await (const _ of conversation.runTurn({ text: "最初の質問" })) {
      // drain
    }

    streamMock.mockResolvedValueOnce({
      fullStream: fakeFullStream([textDelta("回答")]),
    });
    for await (const _ of conversation.runTurn({ text: "次の質問" })) {
      // drain
    }

    expect(streamMock).toHaveBeenLastCalledWith(
      [{ role: "user", content: "次の質問" }],
      expect.anything(),
    );
  });

  it("D1 保存が一度失敗した場合は同じ ID で一度だけ再試行する", async () => {
    saveMessagesMock
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ messages: [] });
    const conversation = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });

    await conversation.persistTurn({
      turnIndex: 0,
      userText: "やあ",
      assistantText: "こんにちは",
    });

    expect(saveThreadMock).toHaveBeenCalledTimes(2);
    expect(saveMessagesMock).toHaveBeenCalledTimes(2);
    expect(saveMessagesMock.mock.calls[0]).toEqual(
      saveMessagesMock.mock.calls[1],
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

    const { runTurn } = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });
    const out: string[] = [];
    for await (const d of runTurn({ text: "おはよう" })) {
      out.push(d);
    }

    expect(out).toEqual(["おはよう", "いい天気だね"]);
  });

  it("tool-call/tool-result イベントはテキストに含めず記録のみ行う", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([
        textDelta("調べてみるね"),
        toolCall("voiceAnswerTool"),
        { type: "tool-result", payload: {} },
        textDelta("音威子府そばだよ"),
      ]),
    });

    const { runTurn } = await createVoiceConversation({
      env,
      from: "client:x",
      callSid: "CA123",
    });
    const out: string[] = [];
    for await (const d of runTurn({ text: "観光スポット教えて" })) {
      out.push(d);
    }

    expect(out).toEqual(["調べてみるね", "音威子府そばだよ"]);
  });

  it("ターン完了時に llm timing を1回記録する（intent 分類なし）", async () => {
    streamMock.mockResolvedValue({
      fullStream: fakeFullStream([textDelta("こん"), textDelta("にちは")]),
    });
    const infoSpy = vi.spyOn(logger, "info");

    const { runTurn } = await createVoiceConversation({
      env,
      from: "client:tester",
      callSid: "CA123",
    });
    for await (const _ of runTurn({ text: "やあ" })) {
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

    const { runTurn } = await createVoiceConversation({
      env,
      from: "client:x",
      callSid: "CA123",
    });
    const out: string[] = [];
    for await (const d of runTurn({ text: "hi", signal: controller.signal })) {
      out.push(d);
      if (d === "a") controller.abort();
    }

    expect(out).toEqual(["a"]);
    expect(streamMock).toHaveBeenCalledWith(
      [{ role: "user", content: "hi" }],
      expect.objectContaining({ abortSignal: controller.signal }),
    );
    const { requestContext } = streamMock.mock.calls[0][1];
    expect(requestContext.get("voiceTurnSignal")).toBe(controller.signal);
  });
});
