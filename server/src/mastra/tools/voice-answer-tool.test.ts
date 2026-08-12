import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import {
  createVoiceFindingsSlot,
  createVoicePrefetchSlot,
  type VoiceFindingsSlot,
  type VoicePrefetchSlot,
} from "~/services/voice/findings-slot";

const { knowledgeGen, webGen, summarizerGen, loggerError } = vi.hoisted(() => ({
  knowledgeGen: vi.fn(),
  webGen: vi.fn(),
  summarizerGen: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("~/mastra/agents/voice-summarizer-agent", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/mastra/agents/voice-summarizer-agent")
  >()),
  voiceSummarizerAgent: { generate: summarizerGen },
}));
vi.mock("~/mastra/agents/knowledge-agent", () => ({
  createKnowledgeAgent: () => ({ generate: knowledgeGen }),
}));
vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  createWebResearcherAgent: () => ({ generate: webGen }),
}));
vi.mock("~/lib/logger", () => ({
  logger: { error: loggerError, info: vi.fn(), warn: vi.fn() },
}));

const { voiceAnswerTool } = await import("./voice-answer-tool");

const holdFn = vi.fn();

type CallOptions = {
  slot?: VoiceFindingsSlot;
  signal?: AbortSignal;
  source?: "knowledge" | "web";
  prefetch?: VoicePrefetchSlot;
  parentRouting?: boolean;
};

const call = (
  question: string,
  { slot, signal, source, prefetch, parentRouting }: CallOptions = {},
) =>
  callTool(
    voiceAnswerTool,
    { question, ...(source ? { source } : {}) },
    {
      ...(slot ? { voiceFindings: slot } : {}),
      ...(signal ? { voiceTurnSignal: signal } : {}),
      ...(prefetch ? { voicePrefetch: prefetch } : {}),
      ...(parentRouting ? { voiceParentRouting: true } : {}),
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
      entries: [
        { query: "そば", source: "knowledge", text: "営業時間 11:00〜" },
      ],
    };

    const result = await call("営業時間は？", { slot });

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

    const result = await call("村でそば食べられる？", { slot });

    expect(result.answer).toBe("音威子府そばがあるよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(webGen).not.toHaveBeenCalled();
    // 実検索するので保留音を鳴らす
    expect(holdFn).toHaveBeenCalled();
    expect(slot.entries).toEqual([
      {
        query: "村でそば食べられる？",
        source: "knowledge",
        text: "そば店の詳しい資料...",
      },
    ]);
  });

  it("時事の質問は web を full 検索する（knowledge は呼ばない）", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_WEB" })
      .mockResolvedValueOnce({ text: "今は晴れだよ" });
    webGen.mockResolvedValueOnce({ text: "本日の天気は晴れ..." });
    const slot = createVoiceFindingsSlot();

    const result = await call("今日の天気は？", { slot });

    expect(result.answer).toBe("今は晴れだよ");
    expect(webGen).toHaveBeenCalledTimes(1);
    expect(knowledgeGen).not.toHaveBeenCalled();
    expect(slot.entries.at(-1)?.source).toBe("web");
  });

  it("knowledge で足りないと web にエスカレーションし、空振りの knowledge 資料は保存しない", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
      .mockResolvedValueOnce({ text: "NEED_WEB" })
      .mockResolvedValueOnce({ text: "答えだよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "村の一般資料" });
    webGen.mockResolvedValueOnce({ text: "web の資料" });
    const slot = createVoiceFindingsSlot();

    const result = await call("最新の補助金は？", { slot });

    expect(result.answer).toBe("答えだよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(webGen).toHaveBeenCalledTimes(1);
    expect(slot.entries).toEqual([
      { query: "最新の補助金は？", source: "web", text: "web の資料" },
    ]);
  });

  it("どの検索でも答えられないと正直に伝え、空振り資料は保存しない", async () => {
    summarizerGen.mockResolvedValue({ text: "NEED_WEB" });
    knowledgeGen.mockResolvedValueOnce({ text: "無関係" });
    webGen.mockResolvedValueOnce({ text: "無関係" });
    const slot = createVoiceFindingsSlot();

    const result = await call("答えのない質問", { slot });

    expect(result.answer).toContain("わからなかった");
    expect(slot.entries).toEqual([]);
  });

  it("例外時はキャラを保った fallback を返す", async () => {
    summarizerGen.mockRejectedValueOnce(new Error("model error"));

    const result = await call("そば", { slot: createVoiceFindingsSlot() });

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
      entries: [{ query: "前の質問", source: "knowledge", text: "前の資料" }],
    };

    const result = await call("そばの話", { slot });

    expect(result.answer).toBe("答えだよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
    expect(holdFn).toHaveBeenCalled();
  });

  it("要点化の text が undefined でも検索に進む", async () => {
    summarizerGen
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ text: "答えだよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    const result = await call("そばの話", { slot: createVoiceFindingsSlot() });

    expect(result.answer).toBe("答えだよ");
  });

  it("検索後も要点化が空のままなら「わからなかった」と伝える", async () => {
    summarizerGen.mockResolvedValue({ text: "" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });
    webGen.mockResolvedValueOnce({ text: "web 資料" });

    const result = await call("答えのない質問", {
      slot: createVoiceFindingsSlot(),
    });

    expect(result.answer).toContain("わからなかった");
  });

  it("「NEED_KNOWLEDGE。」のような装飾付きセンチネルでも knowledge に route する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE。" })
      .mockResolvedValueOnce({ text: "あるよ" });
    knowledgeGen.mockResolvedValueOnce({ text: "資料" });

    const result = await call("そば食べられる？", {
      slot: createVoiceFindingsSlot(),
    });

    expect(result.answer).toBe("あるよ");
    expect(knowledgeGen).toHaveBeenCalledTimes(1);
  });

  it("装飾付きの NEED_WEB でも web に route する", async () => {
    summarizerGen
      .mockResolvedValueOnce({ text: "NEED_WEB です" })
      .mockResolvedValueOnce({ text: "晴れだよ" });
    webGen.mockResolvedValueOnce({ text: "天気資料" });

    const result = await call("今日の天気は？", {
      slot: createVoiceFindingsSlot(),
    });

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
      entries: [{ query: "前の質問", source: "knowledge", text: "前の資料" }],
    };

    const result = await call("古い質問", { slot, signal: controller.signal });

    expect(slot.entries).toEqual([
      { query: "前の質問", source: "knowledge", text: "前の資料" },
    ]);
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

    await call("そば", {
      slot: createVoiceFindingsSlot(),
      signal: controller.signal,
    });

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

    const result = await call("そば", {
      slot: createVoiceFindingsSlot(),
      signal: controller.signal,
    });

    expect(result.answer).toContain("調べられなかった");
    expect(loggerError).not.toHaveBeenCalled();
  });

  describe("親エージェントによるルーティング", () => {
    it("slot が空なら資料なしの要点化を挟まず、指定された source を直接検索する", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "音威子府そばがあるよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "そばの資料" });
      const slot = createVoiceFindingsSlot();

      const result = await call("村でそば食べられる？", {
        slot,
        source: "knowledge",
        parentRouting: true,
      });

      expect(result.answer).toBe("音威子府そばがあるよ");
      expect(summarizerGen).toHaveBeenCalledTimes(1);
      expect(knowledgeGen).toHaveBeenCalledTimes(1);
    });

    it("source が web なら knowledge を空振りせず web だけ検索する", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "今は晴れだよ" });
      webGen.mockResolvedValueOnce({ text: "天気資料" });

      const result = await call("今日の天気は？", {
        slot: createVoiceFindingsSlot(),
        source: "web",
        parentRouting: true,
      });

      expect(result.answer).toBe("今は晴れだよ");
      expect(knowledgeGen).not.toHaveBeenCalled();
      expect(webGen).toHaveBeenCalledTimes(1);
    });

    it("貯めた資料は番号付きでまとめて要点化に渡し、話題を戻しても検索なしで答える", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "11時からだよ" });
      const slot: VoiceFindingsSlot = {
        entries: [
          { query: "そば", source: "knowledge", text: "営業時間 11:00〜" },
          { query: "郵便局", source: "knowledge", text: "役場の隣" },
        ],
      };

      const result = await call("そばの営業時間って何時からだっけ？", {
        slot,
        source: "knowledge",
        parentRouting: true,
      });

      expect(result.answer).toBe("11時からだよ");
      expect(knowledgeGen).not.toHaveBeenCalled();
      const prompt = summarizerGen.mock.calls[0][0] as string;
      expect(prompt).toContain("【資料1 | 質問「そば」 | knowledge】");
      expect(prompt).toContain("【資料2 | 質問「郵便局」 | knowledge】");
    });

    it("findings が残っているときは深掘りのため従来どおり資料から先に答える", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "11時からだよ" });
      const slot: VoiceFindingsSlot = {
        entries: [
          { query: "そば", source: "knowledge", text: "営業時間 11:00〜" },
        ],
      };

      const result = await call("営業時間は？", {
        slot,
        source: "knowledge",
        parentRouting: true,
      });

      expect(result.answer).toBe("11時からだよ");
      expect(knowledgeGen).not.toHaveBeenCalled();
    });

    it("findings で答えられないときの検索先は要点化の提案ではなく親の source に従う", async () => {
      summarizerGen
        .mockResolvedValueOnce({ text: "NEED_WEB" })
        .mockResolvedValueOnce({ text: "定休日は月曜だよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "定休日の資料" });
      const slot: VoiceFindingsSlot = {
        entries: [{ query: "そば", source: "knowledge", text: "前の資料" }],
      };

      const result = await call("そばの定休日は？", {
        slot,
        source: "knowledge",
        parentRouting: true,
      });

      expect(result.answer).toBe("定休日は月曜だよ");
      expect(knowledgeGen).toHaveBeenCalledTimes(1);
      expect(webGen).not.toHaveBeenCalled();
    });

    it("親が web を指定していれば findings 不発時も knowledge を空振りしない", async () => {
      summarizerGen
        .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
        .mockResolvedValueOnce({ text: "明日は雨だよ" });
      webGen.mockResolvedValueOnce({ text: "天気資料" });
      const slot: VoiceFindingsSlot = {
        entries: [{ query: "そば", source: "knowledge", text: "前の資料" }],
      };

      const result = await call("明日の天気は？", {
        slot,
        source: "web",
        parentRouting: true,
      });

      expect(result.answer).toBe("明日は雨だよ");
      expect(webGen).toHaveBeenCalledTimes(1);
      expect(knowledgeGen).not.toHaveBeenCalled();
    });

    it("source 未指定なら要点化の提案にフォールバックする", async () => {
      summarizerGen
        .mockResolvedValueOnce({ text: "NEED_WEB" })
        .mockResolvedValueOnce({ text: "晴れだよ" });
      webGen.mockResolvedValueOnce({ text: "天気資料" });
      const slot: VoiceFindingsSlot = {
        entries: [{ query: "そば", source: "knowledge", text: "前の資料" }],
      };

      const result = await call("明日の天気は？", {
        slot,
        parentRouting: true,
      });

      expect(result.answer).toBe("晴れだよ");
      expect(webGen).toHaveBeenCalledTimes(1);
      expect(knowledgeGen).not.toHaveBeenCalled();
    });

    it("オフなら source を無視して従来どおり要点化でルーティングする", async () => {
      summarizerGen
        .mockResolvedValueOnce({ text: "NEED_KNOWLEDGE" })
        .mockResolvedValueOnce({ text: "あるよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "資料" });

      const result = await call("そば食べられる？", {
        slot: createVoiceFindingsSlot(),
        source: "web",
      });

      expect(result.answer).toBe("あるよ");
      expect(knowledgeGen).toHaveBeenCalledTimes(1);
      expect(webGen).not.toHaveBeenCalled();
    });
  });

  describe("投機検索（prefetch）の取り込み", () => {
    it("先行検索の結果があれば knowledge を検索し直さない", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "音威子府そばがあるよ" });
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "村でそば食べられる？",
          promise: Promise.resolve("先に取っておいた資料"),
          abort: vi.fn(),
        },
      };
      const slot = createVoiceFindingsSlot();

      const result = await call("村でそば食べられる？", {
        slot,
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(result.answer).toBe("音威子府そばがあるよ");
      expect(knowledgeGen).not.toHaveBeenCalled();
      expect(slot.entries.at(-1)?.text).toBe("先に取っておいた資料");
      expect(prefetch.current).toBeUndefined();
    });

    it("先行検索が空振りなら通常の検索に落ちる", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "あるよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "本検索の資料" });
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "そば",
          promise: Promise.resolve(""),
          abort: vi.fn(),
        },
      };
      const slot = createVoiceFindingsSlot();

      const result = await call("そば食べられる？", {
        slot,
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(result.answer).toBe("あるよ");
      expect(knowledgeGen).toHaveBeenCalledTimes(1);
      expect(slot.entries.at(-1)?.text).toBe("本検索の資料");
    });

    it("貯めた資料から即答したターンでは先行検索を打ち切って破棄する", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "11時からだよ" });
      const abort = vi.fn();
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "営業時間は？",
          promise: Promise.resolve("未使用の資料"),
          abort,
        },
      };
      const slot: VoiceFindingsSlot = {
        entries: [
          { query: "そば", source: "knowledge", text: "営業時間 11:00〜" },
        ],
      };

      const result = await call("営業時間は？", {
        slot,
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(result.answer).toBe("11時からだよ");
      expect(abort).toHaveBeenCalled();
      expect(prefetch.current).toBeUndefined();
    });

    it("web に route されたターンでは先行検索を使わず打ち切る", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "晴れだよ" });
      webGen.mockResolvedValueOnce({ text: "天気資料" });
      const abort = vi.fn();
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "今日の天気は？",
          promise: Promise.resolve("村の一般資料"),
          abort,
        },
      };

      const result = await call("今日の天気は？", {
        slot: createVoiceFindingsSlot(),
        source: "web",
        parentRouting: true,
        prefetch,
      });

      expect(result.answer).toBe("晴れだよ");
      expect(webGen).toHaveBeenCalledTimes(1);
      expect(knowledgeGen).not.toHaveBeenCalled();
      expect(abort).toHaveBeenCalled();
    });

    it("先行検索の資料で答えられなければ question で knowledge を本検索し直す", async () => {
      summarizerGen
        .mockResolvedValueOnce({ text: "" })
        .mockResolvedValueOnce({ text: "答えだよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "本検索の資料" });
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "あそこの営業時間は？",
          promise: Promise.resolve("的外れな資料"),
          abort: vi.fn(),
        },
      };
      const slot = createVoiceFindingsSlot();

      const result = await call("音威子府そばの営業時間は？", {
        slot,
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(result.answer).toBe("答えだよ");
      expect(knowledgeGen).toHaveBeenCalledWith(
        "音威子府そばの営業時間は？",
        expect.anything(),
      );
      expect(webGen).not.toHaveBeenCalled();
      expect(slot.entries.at(-1)?.text).toBe("本検索の資料");
    });

    it("先行検索が済んでいれば待ちの一言を出さない", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "あるよ" });
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "そば",
          promise: Promise.resolve("資料"),
          abort: vi.fn(),
        },
      };

      await call("そば食べられる？", {
        slot: createVoiceFindingsSlot(),
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(holdFn).not.toHaveBeenCalled();
    });

    it("先行検索が間に合わなければ待ちの一言を出して結果を待つ", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "あるよ" });
      const prefetch: VoicePrefetchSlot = {
        current: {
          query: "そば",
          promise: new Promise<string>((resolve) =>
            setTimeout(() => resolve("遅れて届いた資料"), 300),
          ),
          abort: vi.fn(),
        },
      };
      const slot = createVoiceFindingsSlot();

      await call("そば食べられる？", {
        slot,
        source: "knowledge",
        parentRouting: true,
        prefetch,
      });

      expect(holdFn).toHaveBeenCalled();
      expect(slot.entries.at(-1)?.text).toBe("遅れて届いた資料");
      expect(knowledgeGen).not.toHaveBeenCalled();
    });

    it("スロットが空のままなら通常の検索で動く", async () => {
      summarizerGen.mockResolvedValueOnce({ text: "あるよ" });
      knowledgeGen.mockResolvedValueOnce({ text: "資料" });

      const result = await call("そば食べられる？", {
        slot: createVoiceFindingsSlot(),
        source: "knowledge",
        parentRouting: true,
        prefetch: createVoicePrefetchSlot(),
      });

      expect(result.answer).toBe("あるよ");
      expect(knowledgeGen).toHaveBeenCalledTimes(1);
    });
  });
});
