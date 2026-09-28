import { beforeEach, describe, expect, it, vi } from "vitest";
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

const {
  getMemoryStoreMock,
  saveMessagesMock,
  saveThreadMock,
  streamMock,
  prefetchMock,
} = vi.hoisted(() => ({
  getMemoryStoreMock: vi.fn(),
  saveMessagesMock: vi.fn(),
  saveThreadMock: vi.fn(),
  streamMock: vi.fn(),
  prefetchMock: vi.fn(),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({ getStore: getMemoryStoreMock }),
}));
vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(() => ({})),
}));
vi.mock("~/mastra/tools/voice-answer-tool", () => ({
  startVoicePrefetch: prefetchMock,
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
    prefetchMock.mockReset();
    prefetchMock.mockResolvedValue("投機検索の資料");
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

  describe("割り込み", () => {
    const drain = async (iter: AsyncIterable<string>) => {
      for await (const _ of iter) {
        // drain
      }
    };
    const lastInput = () => streamMock.mock.lastCall?.[0];

    it("中断したターンはユーザー発話と聞かせた分の返事だけを履歴に残す", async () => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("回答")]),
      });
      const conversation = await createVoiceConversation({
        env,
        from: "client:tester",
        callSid: "CA123",
      });

      conversation.recordInterruptedTurn({
        userText: "駅の時刻表は",
        heardText: "えーっとね、駅は",
      });
      await drain(conversation.runTurn({ text: "上りだけでいい" }));

      expect(lastInput()).toEqual([
        { role: "user", content: "駅の時刻表は" },
        { role: "assistant", content: "えーっとね、駅は" },
        { role: "user", content: "上りだけでいい" },
      ]);
    });

    it("何も聞かせないうちに中断したターンはユーザー発話だけを残す", async () => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("回答")]),
      });
      const conversation = await createVoiceConversation({
        env,
        from: "client:tester",
        callSid: "CA123",
      });

      conversation.recordInterruptedTurn({
        userText: "駅の",
        heardText: "",
      });
      await drain(conversation.runTurn({ text: "時刻表が知りたい" }));

      expect(lastInput()).toEqual([
        { role: "user", content: "駅の" },
        { role: "user", content: "時刻表が知りたい" },
      ]);
    });

    it("読み上げ中に遮られた直前の返事は聞かせた分に切り詰める", async () => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("駅は北口だよ。バスもあるよ。")]),
      });
      const conversation = await createVoiceConversation({
        env,
        from: "client:tester",
        callSid: "CA123",
      });
      await drain(conversation.runTurn({ text: "駅はどこ" }));

      conversation.truncateLastReply("駅は北口だよ。");
      await drain(conversation.runTurn({ text: "北口ってどっち" }));

      expect(lastInput()).toEqual([
        { role: "user", content: "駅はどこ" },
        { role: "assistant", content: "駅は北口だよ。" },
        { role: "user", content: "北口ってどっち" },
      ]);
    });

    it("直前の返事を一言も聞かせずに遮られたら返事を履歴から外す", async () => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("駅は北口だよ。")]),
      });
      const conversation = await createVoiceConversation({
        env,
        from: "client:tester",
        callSid: "CA123",
      });
      await drain(conversation.runTurn({ text: "駅はどこ" }));

      conversation.truncateLastReply("");
      await drain(conversation.runTurn({ text: "やっぱりバス" }));

      expect(lastInput()).toEqual([
        { role: "user", content: "駅はどこ" },
        { role: "user", content: "やっぱりバス" },
      ]);
    });

    it("返事がまだ無いときの切り詰めは何もしない", async () => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("回答")]),
      });
      const conversation = await createVoiceConversation({
        env,
        from: "client:tester",
        callSid: "CA123",
      });

      conversation.truncateLastReply("もしもし、ねっぷ");
      await drain(conversation.runTurn({ text: "こんにちは" }));

      expect(lastInput()).toEqual([{ role: "user", content: "こんにちは" }]);
    });
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

  describe("投機検索（prefetch）", () => {
    const drain = async (
      params: Parameters<
        Awaited<ReturnType<typeof createVoiceConversation>>["runTurn"]
      >[0],
    ) => {
      streamMock.mockResolvedValue({
        fullStream: fakeFullStream([textDelta("はい")]),
      });
      const { runTurn } = await createVoiceConversation({
        env,
        from: "client:x",
        callSid: "CA123",
      });
      for await (const _ of runTurn(params)) {
      }
    };

    it("問いかけなら親の判断を待たず検索を起動し、ターン専用スロットでツールへ渡す", async () => {
      let currentAtStream: unknown;
      streamMock.mockImplementation(async (_input, opts) => {
        currentAtStream = opts.requestContext.get("voicePrefetch")?.current;
        return { fullStream: fakeFullStream([textDelta("はい")]) };
      });
      const { runTurn } = await createVoiceConversation({
        env,
        from: "client:x",
        callSid: "CA123",
      });
      for await (const _ of runTurn({
        text: "そば屋はどこ？",
        prefetchEnabled: true,
      })) {
      }

      expect(prefetchMock).toHaveBeenCalledWith(
        expect.objectContaining({ question: "そば屋はどこ？" }),
      );
      expect(currentAtStream).toMatchObject({ query: "そば屋はどこ？" });
    });

    it("問いかけでない雑談では起動しない", async () => {
      await drain({ text: "今日は疲れたよ", prefetchEnabled: true });

      expect(prefetchMock).not.toHaveBeenCalled();
    });

    it("prefetchEnabled でなければ起動しない", async () => {
      await drain({ text: "そば屋はどこ？" });

      expect(prefetchMock).not.toHaveBeenCalled();
    });

    it("ツールに消費されなかった投機検索はターン終了時に中断する", async () => {
      await drain({ text: "そば屋はどこ？", prefetchEnabled: true });

      const prefetchSignal = prefetchMock.mock.calls[0][0].signal;
      expect(prefetchSignal.aborted).toBe(true);
    });

    it("stream の初期化が失敗しても投機検索を中断する", async () => {
      streamMock.mockRejectedValueOnce(new Error("api error"));
      const { runTurn } = await createVoiceConversation({
        env,
        from: "client:x",
        callSid: "CA123",
      });

      await expect(async () => {
        for await (const _ of runTurn({
          text: "そば屋はどこ？",
          prefetchEnabled: true,
        })) {
        }
      }).rejects.toThrow("api error");

      const prefetchSignal = prefetchMock.mock.calls[0][0].signal;
      expect(prefetchSignal.aborted).toBe(true);
    });

    it("ターンの中断で投機検索も即座に中断される", async () => {
      const controller = new AbortController();
      let abortedDuringStream: boolean | undefined;
      streamMock.mockImplementation(async () => {
        controller.abort();
        abortedDuringStream = prefetchMock.mock.calls[0][0].signal.aborted;
        return { fullStream: fakeFullStream([]) };
      });
      const { runTurn } = await createVoiceConversation({
        env,
        from: "client:x",
        callSid: "CA123",
      });
      for await (const _ of runTurn({
        text: "そば屋はどこ？",
        prefetchEnabled: true,
        signal: controller.signal,
      })) {
      }

      expect(abortedDuringStream).toBe(true);
    });

    it("parentRouting を requestContext 経由でツールへ渡す", async () => {
      await drain({ text: "そば屋はどこ？", parentRouting: true });

      const { requestContext } = streamMock.mock.calls[0][1];
      expect(requestContext.get("voiceParentRouting")).toBe(true);
    });
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
