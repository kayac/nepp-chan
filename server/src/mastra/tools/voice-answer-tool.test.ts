import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import {
  createVoiceFindingsSlot,
  type VoiceFindingsSlot,
} from "~/services/voice/findings-slot";

const { runResearchMock, summarizerGen, loggerError } = vi.hoisted(() => ({
  runResearchMock: vi.fn(),
  summarizerGen: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("~/mastra/agents/voice-summarizer-agent", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/mastra/agents/voice-summarizer-agent")
  >()),
  voiceSummarizerAgent: { generate: summarizerGen },
}));
vi.mock("~/mastra/workflows/research-workflow", () => ({
  runResearch: runResearchMock,
}));
vi.mock("~/lib/logger", () => ({
  logger: { error: loggerError, info: vi.fn(), warn: vi.fn() },
}));

const { voiceAnswerTool } = await import("./voice-answer-tool");

const holdFn = vi.fn();

type CallOptions = {
  slot?: VoiceFindingsSlot;
  signal?: AbortSignal;
};

const call = (question: string, { slot, signal }: CallOptions = {}) =>
  callTool(
    voiceAnswerTool,
    { question },
    {
      ...(slot ? { voiceFindings: slot } : {}),
      ...(signal ? { voiceTurnSignal: signal } : {}),
      voiceSearchStart: holdFn,
    },
  );

beforeEach(() => {
  runResearchMock.mockReset();
  summarizerGen.mockReset();
  loggerError.mockReset();
  holdFn.mockReset();
});

describe("voiceAnswerTool", () => {
  it("貯めた資料で答えられるなら調べずに要点を返し、保留音も鳴らさない", async () => {
    summarizerGen.mockResolvedValueOnce({ text: "11時からだよ" });
    const slot: VoiceFindingsSlot = {
      entries: [{ query: "そば", text: "営業時間 11:00〜" }],
    };

    const result = await call("営業時間は？", { slot });

    expect(result.answer).toBe("11時からだよ");
    expect(runResearchMock).not.toHaveBeenCalled();
    expect(holdFn).not.toHaveBeenCalled();
  });

  it("貯めた資料は番号付きでまとめて要点化に渡す", async () => {
    summarizerGen.mockResolvedValueOnce({ text: "月曜休みだよ" });
    const slot: VoiceFindingsSlot = {
      entries: [
        { query: "そば", text: "営業時間 11:00〜" },
        { query: "定休日", text: "毎週月曜休み" },
      ],
    };

    await call("休みは？", { slot });

    const prompt = summarizerGen.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("【資料1 | 質問「そば」】");
    expect(prompt).toContain("【資料2 | 質問「定休日」】");
  });

  it("資料が無ければ保留音を鳴らして調べ物ワークフローで調べ、答えた資料を貯める", async () => {
    runResearchMock.mockResolvedValueOnce({ memo: "寮費は月額3万円" });
    summarizerGen.mockResolvedValueOnce({ text: "月3万円だよ" });
    const slot = createVoiceFindingsSlot();

    const result = await call("寮費は？", { slot });

    expect(summarizerGen).toHaveBeenCalledTimes(1);
    expect(holdFn).toHaveBeenCalled();
    expect(runResearchMock.mock.calls[0]?.[0]).toMatchObject({
      question: "寮費は？",
    });
    expect(result.answer).toBe("月3万円だよ");
    expect(slot.entries).toEqual([
      { query: "寮費は？", text: "寮費は月額3万円" },
    ]);
  });

  it("貯めた資料で答えられなければ調べ物ワークフローで調べる", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_SEARCH" })
      .mockResolvedValueOnce({ text: "10月3日だよ" });
    runResearchMock.mockResolvedValueOnce({ memo: "粗大ごみは10月3日" });
    const slot: VoiceFindingsSlot = {
      entries: [{ query: "寮費", text: "月額3万円" }],
    };

    const result = await call("粗大ごみは？", { slot });

    expect(runResearchMock).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("10月3日だよ");
  });

  it("「NEED_SEARCH。」のような装飾付きでも調べに進む", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_SEARCH。" })
      .mockResolvedValueOnce({ text: "あるよ" });
    runResearchMock.mockResolvedValueOnce({ memo: "資料" });

    const result = await call("そば", {
      slot: { entries: [{ query: "前", text: "前の資料" }] },
    });

    expect(runResearchMock).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("あるよ");
  });

  it("調べても答えられなければ正直に伝え、資料は貯めない", async () => {
    runResearchMock.mockResolvedValueOnce({ memo: "関係ない資料" });
    summarizerGen.mockResolvedValueOnce({ text: "NEED_SEARCH" });
    const slot = createVoiceFindingsSlot();

    const result = await call("謎の質問", { slot });

    expect(result.answer).toContain("わからなかった");
    expect(slot.entries).toEqual([]);
  });

  it("要点化が空文字なら答えられなかったものとして扱う", async () => {
    runResearchMock.mockResolvedValueOnce({ memo: "資料" });
    summarizerGen.mockResolvedValueOnce({ text: "" });

    const result = await call("そば");

    expect(result.answer).toContain("わからなかった");
  });

  it("voiceTurnSignal を要点化と調べ物ワークフローに渡す", async () => {
    const controller = new AbortController();
    runResearchMock.mockResolvedValueOnce({ memo: "資料" });
    summarizerGen.mockResolvedValueOnce({ text: "あるよ" });

    await call("そば", { signal: controller.signal });

    expect(runResearchMock.mock.calls[0]?.[0]).toMatchObject({
      signal: controller.signal,
    });
    expect(summarizerGen).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ abortSignal: controller.signal }),
    );
  });

  it("中断後に調べ物が終わっても資料は貯めず、要点化もしない", async () => {
    const controller = new AbortController();
    runResearchMock.mockImplementationOnce(async () => {
      controller.abort();
      return { memo: "古い質問の資料" };
    });
    const slot = createVoiceFindingsSlot();

    const result = await call("古い質問", { slot, signal: controller.signal });

    expect(slot.entries).toEqual([]);
    expect(summarizerGen).not.toHaveBeenCalled();
    expect(result.answer).toContain("調べられなかった");
  });

  it("中断による例外はエラーログを出さず fallback を返す", async () => {
    const controller = new AbortController();
    controller.abort();
    runResearchMock.mockRejectedValueOnce(new Error("canceled"));

    const result = await call("そば", { signal: controller.signal });

    expect(result.answer).toContain("調べられなかった");
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("例外時はキャラを保った fallback を返し、エラーログを残す", async () => {
    runResearchMock.mockRejectedValueOnce(new Error("boom"));

    const result = await call("そば");

    expect(result.answer).toContain("調べられなかった");
    expect(loggerError).toHaveBeenCalled();
  });
});
