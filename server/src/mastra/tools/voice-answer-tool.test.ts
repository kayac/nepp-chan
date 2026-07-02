import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import {
  createVoiceFindingsSlot,
  type VoiceFindingsSlot,
} from "~/services/voice/findings-slot";

const { knowledgeGen, webGen, summarizerGen, loggerError } = vi.hoisted(() => ({
  knowledgeGen: vi.fn(),
  webGen: vi.fn(),
  summarizerGen: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("~/mastra/agents/knowledge-agent", () => ({
  knowledgeAgent: { generate: knowledgeGen },
}));
vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  webResearcherAgent: { generate: webGen },
}));
vi.mock("~/mastra/agents/voice-summarizer-agent", () => ({
  voiceSummarizerAgent: { generate: summarizerGen },
  NEED_KNOWLEDGE: "NEED_KNOWLEDGE",
  NEED_WEB: "NEED_WEB",
}));
vi.mock("~/lib/logger", () => ({
  logger: { error: loggerError, info: vi.fn(), warn: vi.fn() },
}));

const { voiceAnswerTool } = await import("./voice-answer-tool");

const holdFn = vi.fn();

const call = (
  question: string,
  slot?: VoiceFindingsSlot,
  signal?: AbortSignal,
) =>
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
  knowledgeGen.mockReset();
  webGen.mockReset();
  summarizerGen.mockReset();
  loggerError.mockReset();
  holdFn.mockReset();
});

describe("voiceAnswerTool", () => {
  it("直近 findings で答えられるなら検索せず要点を返す", async () => {
    summarizerGen.mockResolvedValueOnce({ text: "11時からだよ" });
    const slot: VoiceFindingsSlot = {
      current: { query: "そば", source: "knowledge", text: "営業時間 11:00〜" },
    };

    const result = await call("営業時間は？", slot);

    expect(result.answer).toBe("11時からだよ");
    expect(knowledgeGen).not.toHaveBeenCalled();
    expect(webGen).not.toHaveBeenCalled();
    // slot ヒットは実検索しないので保留音を鳴らさない
    expect(holdFn).not.toHaveBeenCalled();
  });

  it("slot 空で村の質問なら knowledge を full 検索し、findings を slot に保存する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
      .mockResolvedValueOnce({ text: "音威子府そばがあるよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "そば店の詳しい資料..." });
    const slot = createVoiceFindingsSlot();

    const result = await call("村でそば食べられる？", slot);

    expect(result.answer).toBe("音威子府そばがあるよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(webGen).not.toHaveBeenCalled();
    // 実検索するので保留音を鳴らす
    expect(holdFn).toHaveBeenCalled();
    expect(slot.current).toEqual({
      query: "村でそば食べられる？",
      source: "knowledge",
      text: "そば店の詳しい資料...",
    });
  });

  it("時事の質問は web を full 検索する（knowledge は呼ばない）", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_WEB" })
      .mockResolvedValueOnce({ text: "今は晴れだよ" });
    webGen.mockResolvedValueOnce({ text: "本日の天気は晴れ..." });
    const slot = createVoiceFindingsSlot();

    const result = await call("今日の天気は？", slot);

    expect(result.answer).toBe("今は晴れだよ");
    expect(webGen).toHaveBeenCalledTimes(1);
    expect(knowledgeGen).not.toHaveBeenCalled();
    expect(slot.current?.source).toBe("web");
  });

  it("knowledge で足りないと web にエスカレーションする", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
      .mockResolvedValueOnce({ text: "NEED_WEB" })
      .mockResolvedValueOnce({ text: "答えだよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "村の一般資料" });
    webGen.mockResolvedValueOnce({ text: "web の資料" });
    const slot = createVoiceFindingsSlot();

    const result = await call("最新の補助金は？", slot);

    expect(result.answer).toBe("答えだよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(webGen).toHaveBeenCalledTimes(1);
    expect(slot.current?.source).toBe("web");
  });

  it("どの検索でも答えられないと正直に伝える", async () => {
    summarizerGen.mockResolvedValue({ text: "NEED_WEB" });
    knowledgeGen.mockResolvedValueOnce({ text: "無関係" });
    webGen.mockResolvedValueOnce({ text: "無関係" });

    const result = await call("答えのない質問", createVoiceFindingsSlot());

    expect(result.answer).toContain("わからなかった");
  });

  it("例外時はキャラを保った fallback を返す", async () => {
    summarizerGen.mockRejectedValueOnce(new Error("model error"));

    const result = await call("そば", createVoiceFindingsSlot());

    expect(result.answer).toContain("調べられなかった");
  });

  it("slot が無くても動作する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
      .mockResolvedValueOnce({ text: "あるよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    const result = await call("そば食べられる？");

    expect(result.answer).toBe("あるよ");
  });

  it("要点化が空文字なら空の answer を返さず検索に進み、保留音を鳴らす", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "" })
      .mockResolvedValueOnce({ text: "答えだよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });
    const slot: VoiceFindingsSlot = {
      current: { query: "前の質問", source: "knowledge", text: "前の資料" },
    };

    const result = await call("そばの話", slot);

    expect(result.answer).toBe("答えだよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(holdFn).toHaveBeenCalled();
  });

  it("要点化の text が undefined でも検索に進む", async () => {
    summarizerGen
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ text: "答えだよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    const result = await call("そばの話", createVoiceFindingsSlot());

    expect(result.answer).toBe("答えだよ");
  });

  it("検索後も要点化が空のままなら「わからなかった」と伝える", async () => {
    summarizerGen.mockResolvedValue({ text: "" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });
    webGen.mockResolvedValueOnce({ text: "web 資料" });

    const result = await call("答えのない質問", createVoiceFindingsSlot());

    expect(result.answer).toContain("わからなかった");
  });

  it("「NEED_KNOWLEDGE。」のような装飾付きセンチネルでも knowledge に route する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE。" })
      .mockResolvedValueOnce({ text: "あるよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    const result = await call("そば食べられる？", createVoiceFindingsSlot());

    expect(result.answer).toBe("あるよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
  });

  it("装飾付きの NEED_WEB でも web に route する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_WEB です" })
      .mockResolvedValueOnce({ text: "晴れだよ" });
    webGen.mockResolvedValueOnce({ text: "天気資料" });

    const result = await call("今日の天気は？", createVoiceFindingsSlot());

    expect(result.answer).toBe("晴れだよ");
    expect(webGen).toHaveBeenCalledTimes(1);
    expect(knowledgeGen).not.toHaveBeenCalled();
  });

  it("中断後に完走した検索の findings は slot に書き込まず、次の検索にも進まない", async () => {
    const controller = new AbortController();
    summarizerGen.mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" });
    knowledgeGen.mockImplementationOnce(async () => {
      controller.abort();
      return { text: "古い質問の資料" };
    });
    const slot: VoiceFindingsSlot = {
      current: { query: "前の質問", source: "knowledge", text: "前の資料" },
    };

    const result = await call("古い質問", slot, controller.signal);

    expect(slot.current).toEqual({
      query: "前の質問",
      source: "knowledge",
      text: "前の資料",
    });
    expect(result.answer).toContain("調べられなかった");
    expect(webGen).not.toHaveBeenCalled();
    expect(summarizerGen).toHaveBeenCalledTimes(1);
  });

  it("voiceTurnSignal を要点化・検索の generate に渡す", async () => {
    const controller = new AbortController();
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
      .mockResolvedValueOnce({ text: "あるよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    await call("そば", createVoiceFindingsSlot(), controller.signal);

    expect(summarizerGen).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ abortSignal: controller.signal }),
    );
    expect(knowledgeGen).toHaveBeenCalledWith(
      "そば",
      expect.objectContaining({ abortSignal: controller.signal }),
    );
  });

  it("中断による例外はエラーログを出さず fallback を返す", async () => {
    const controller = new AbortController();
    controller.abort();
    summarizerGen.mockRejectedValueOnce(new Error("aborted"));

    const result = await call(
      "そば",
      createVoiceFindingsSlot(),
      controller.signal,
    );

    expect(result.answer).toContain("調べられなかった");
    expect(loggerError).not.toHaveBeenCalled();
  });
});
