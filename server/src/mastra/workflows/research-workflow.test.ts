import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  knowledgeGenerate,
  webGenerate,
  classifyTurnMock,
  searchMock,
  findBroadcastsMock,
} = vi.hoisted(() => ({
  knowledgeGenerate: vi.fn(),
  webGenerate: vi.fn(),
  classifyTurnMock: vi.fn(),
  searchMock: vi.fn(),
  findBroadcastsMock: vi.fn(),
}));

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: { findByKeyword: findBroadcastsMock },
}));

vi.mock("~/services/knowledge/search", () => ({
  searchKnowledge: searchMock,
}));

vi.mock("~/mastra/agents/knowledge-agent", () => ({
  knowledgeAgent: { generate: knowledgeGenerate },
}));

vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  webResearcherAgent: { generate: webGenerate },
}));

vi.mock("~/lib/classify-intent", () => ({
  classifyTurn: classifyTurnMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runResearch } = await import("./research-workflow");

const vectorize = {} as VectorizeIndex;

const contextWithKey = (key?: string, withSearch = true) => {
  const ctx = new RequestContext();
  ctx.set("env", {
    TYPESAFE_API_KEY: key,
    ...(withSearch && {
      VECTORIZE: vectorize,
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
    }),
  });
  ctx.set("db", {} as D1Database);
  return ctx;
};

const routeResponse = (village: number) => ({
  intent: "thinking",
  route: village >= 0.3 ? "village" : "outside",
});

beforeEach(() => {
  knowledgeGenerate.mockReset();
  webGenerate.mockReset();
  classifyTurnMock.mockReset();
  searchMock.mockReset();
  searchMock.mockResolvedValue({ results: [] });
  findBroadcastsMock.mockReset();
  findBroadcastsMock.mockResolvedValue([]);
});

describe("runResearch", () => {
  it("村のことで取れたなら、ナレッジだけで調査メモを返す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "寮費は月額30,000円", coverage: "取れた" },
    });

    const result = await runResearch({
      question: "寮費は？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("寮費は月額30,000円");
  });

  it("構造化出力が得られなければ、本文をメモにして取れない扱いで Web でも調べる", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "寮費は月3万円",
    });
    webGenerate.mockResolvedValueOnce({ text: "補足" });

    const result = await runResearch({
      question: "寮費は？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate).toHaveBeenCalledTimes(1);
    expect(result.memo).toContain("寮費は月3万円");
    expect(result.memo).toContain("補足");
  });

  it("村のことで一部なら、Web に回さずナレッジのメモを返す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "粗大ごみは10月3日", coverage: "一部" },
    });

    const result = await runResearch({
      question: "粗大ごみはいつ出せる？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("粗大ごみは10月3日");
  });

  it("調べ先の判定には、補った質問ではなくユーザーの発言を使う", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });

    await runResearch({
      question: "子育て支援制度の最新の申請期限と窓口",
      userText: "子供が生まれたら何をしたらいい",
      requestContext: contextWithKey("k"),
    });

    expect(classifyTurnMock.mock.calls[0]?.[0]).toEqual({
      text: "子供が生まれたら何をしたらいい",
    });
  });

  it("村のことで取れないなら、確認済みの内容を添えて Web で探す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "村名の記載はあるが由来は無い", coverage: "取れない" },
    });
    webGenerate.mockResolvedValueOnce({ text: "由来はアイヌ語" });

    const result = await runResearch({
      question: "村の名前の由来は？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate.mock.calls[0]?.[0]).toContain(
      "村名の記載はあるが由来は無い",
    );
    expect(result.memo).toContain("由来はアイヌ語");
  });

  it("ターンの分類で調べ先が決まっていれば、分類し直さずそれを使う", async () => {
    webGenerate.mockResolvedValueOnce({ text: "明日は雪" });
    const ctx = contextWithKey("k");
    ctx.set("turnRoute", Promise.resolve("outside"));

    const result = await runResearch({
      question: "明日の天気は？",
      requestContext: ctx,
    });

    expect(classifyTurnMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("明日は雪");
  });

  it("村外・時事なら、ナレッジを使わず Web だけで調べる", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.1));
    webGenerate.mockResolvedValueOnce({ text: "明日は雪" });

    const result = await runResearch({
      question: "明日の天気は？",
      requestContext: contextWithKey("k"),
    });

    expect(knowledgeGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("明日は雪");
  });

  it("村のことなら、質問そのままで先に検索し、結果をナレッジ用エージェントに渡す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    searchMock.mockResolvedValueOnce({
      results: [
        {
          content: "寮費は月額30,000円",
          score: 0.9,
          source: "official/otoko/qa.md",
          title: "おと高Q&A",
          url: "https://example.com/qa",
        },
      ],
    });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });
    const ctx = contextWithKey("k");

    await runResearch({ question: "寮費は？", requestContext: ctx });

    expect(searchMock).toHaveBeenCalledWith("寮費は？", vectorize, "g", ctx);
    const prompt = knowledgeGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("寮費は月額30,000円");
    expect(prompt).toContain("おと高Q&A");
    expect(prompt).toContain("https://example.com/qa");
  });

  it("検索語が渡されたら、検索語ごとに並列で先に検索し、同じ資料は 1 回だけ渡す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    const shared = {
      content: "出生祝金は3万円",
      score: 0.9,
      source: "official/kosodate.md",
    };
    searchMock
      .mockResolvedValueOnce({ results: [shared] })
      .mockResolvedValueOnce({
        results: [
          shared,
          {
            content: "児童手当は認定請求が必要",
            score: 0.8,
            source: "official/jidou.md",
          },
        ],
      });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });
    const ctx = contextWithKey("k");

    await runResearch({
      question: "子供が生まれました。村の支援制度はありますか？",
      queries: ["出生祝金", "児童手当"],
      requestContext: ctx,
    });

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith("出生祝金", vectorize, "g", ctx);
    expect(searchMock).toHaveBeenCalledWith("児童手当", vectorize, "g", ctx);
    const prompt = knowledgeGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("子供が生まれました。村の支援制度はありますか？");
    expect(prompt.match(/出生祝金は3万円/g)).toHaveLength(1);
    expect(prompt).toContain("児童手当は認定請求が必要");
  });

  it("同じ検索語は 1 回だけ検索する", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });

    await runResearch({
      question: "q",
      queries: ["児童手当", "児童手当", "出生祝金"],
      requestContext: contextWithKey("k"),
    });

    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("検索語が空なら質問そのままで検索する", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });
    const ctx = contextWithKey("k");

    await runResearch({
      question: "寮費は？",
      queries: [],
      requestContext: ctx,
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith("寮費は？", vectorize, "g", ctx);
  });

  it("ユーザーの発言と補った質問が違えば、両方と検索語をナレッジ用エージェントに渡す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    searchMock.mockResolvedValue({ results: [] });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });

    await runResearch({
      question: "音威子府村の眼科の診療日と受付時間",
      userText: "眼科の診療日を教えて",
      queries: ["眼科 診療日", "眼科 受付時間"],
      requestContext: contextWithKey("k"),
    });

    const prompt = knowledgeGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("ユーザーの発言: 眼科の診療日を教えて");
    expect(prompt).toContain(
      "文脈を補った質問: 音威子府村の眼科の診療日と受付時間",
    );
    expect(prompt).toContain("検索語: 眼科 診療日 / 眼科 受付時間");
  });

  it("Vectorize が使えなければ先の検索を飛ばし、ナレッジ用エージェントに任せる", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });

    await runResearch({
      question: "q",
      requestContext: contextWithKey("k", false),
    });

    expect(searchMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("先の検索が失敗したら、検索結果を渡さずナレッジ用エージェントに任せる", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    searchMock.mockResolvedValueOnce({ results: [], error: "vectorize 500" });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate.mock.calls[0]?.[0]).not.toContain(
      "村のナレッジの検索結果",
    );
  });

  it("LINE 配信も検索語で先に検索し、新しい順にナレッジ用エージェントへ渡す", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    findBroadcastsMock.mockResolvedValueOnce([
      {
        title: "除雪のお知らせ",
        body: "明日は除雪車が通ります",
        sentAt: "2026-10-01T09:00:00Z",
      },
    ]);
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });
    const ctx = contextWithKey("k");

    await runResearch({
      question: "除雪はいつ？",
      queries: ["除雪", "除雪車"],
      requestContext: ctx,
    });

    expect(findBroadcastsMock).toHaveBeenCalledWith(
      ctx.get("db"),
      "除雪 除雪車",
      5,
    );
    expect(knowledgeGenerate.mock.calls[0]?.[0]).toContain("除雪のお知らせ");
  });

  it("村外なら先の検索もしない", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.1));
    webGenerate.mockResolvedValueOnce({ text: "明日は雪" });

    await runResearch({
      question: "明日の天気は？",
      requestContext: contextWithKey("k"),
    });

    expect(searchMock).not.toHaveBeenCalled();
  });

  it("signal が中断されたら、エージェントの生成を止めて失敗にする", async () => {
    classifyTurnMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockImplementationOnce(
      (_prompt: string, options: { abortSignal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.abortSignal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const controller = new AbortController();

    const research = runResearch({
      question: "q",
      requestContext: contextWithKey("k"),
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(knowledgeGenerate).toHaveBeenCalled());
    const { abortSignal } = knowledgeGenerate.mock.calls[0]?.[1] ?? {};
    expect(abortSignal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(abortSignal.aborted).toBe(true);

    await expect(research).rejects.toThrow();
  });

  it("呼ばれた時点で signal が中断済みなら、何も調べずに失敗にする", async () => {
    classifyTurnMock.mockResolvedValue(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValue({
      steps: [],
      object: { memo: "メモ", coverage: "取れた" },
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      runResearch({
        question: "q",
        requestContext: contextWithKey("k"),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(searchMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).not.toHaveBeenCalled();
  });
});
