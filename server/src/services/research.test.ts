import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { webGenerate, decideMock, searchMock, findBroadcastsMock } = vi.hoisted(
  () => ({
    webGenerate: vi.fn(),
    decideMock: vi.fn(),
    searchMock: vi.fn(),
    findBroadcastsMock: vi.fn(),
  }),
);

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: { findByKeyword: findBroadcastsMock },
}));

vi.mock("~/services/knowledge/search", () => ({
  searchKnowledge: searchMock,
}));

vi.mock("~/services/decision/decider", () => ({
  decide: decideMock,
}));

vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  webResearcherAgent: { generate: webGenerate },
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { research } = await import("./research");

const requestContext = () => {
  const ctx = new RequestContext();
  ctx.set("env", {
    VECTORIZE: {} as VectorizeIndex,
    GOOGLE_GENERATIVE_AI_API_KEY: "g",
  });
  ctx.set("db", {} as D1Database);
  return ctx;
};

type AspectSpec = {
  topic: string;
  queries: string[];
  web?: boolean;
};

const run = (
  question: string,
  aspects: AspectSpec[],
  chunksPerAspect?: number,
) =>
  research(
    { question, aspects },
    { requestContext: requestContext(), chunksPerAspect },
  );

const routes = (...villageProbabilities: number[]) =>
  Object.fromEntries(
    villageProbabilities.map((village, i) => [
      `a${i}`,
      {
        type: "choice",
        choice: village >= 0.5 ? "village" : "outside",
        probabilities: { village, outside: 1 - village },
      },
    ]),
  );

const hit = (content: string, score = 0.9) => ({
  results: [{ content, score, source: "doc" }],
});

const hits = (...entries: [content: string, score: number][]) => ({
  results: entries.map(([content, score]) => ({
    content,
    score,
    source: "doc",
  })),
});

const searchedQueries = () => searchMock.mock.calls.map((c) => c[0]);

beforeEach(() => {
  webGenerate.mockReset().mockResolvedValue({ text: "" });
  decideMock.mockReset().mockResolvedValue(undefined);
  searchMock.mockReset().mockResolvedValue({ results: [] });
  findBroadcastsMock.mockReset().mockResolvedValue([]);
});

describe("research", () => {
  it("観点ごとに村の資料を引き、観点から番号で参照する資料として返す", async () => {
    searchMock
      .mockResolvedValueOnce(hit("祝い金は10万円"))
      .mockResolvedValueOnce(hit("保育料は無料"));

    const materials = await run("子どもが生まれた。支援は？", [
      { topic: "出産祝い金", queries: ["出産祝い金"], web: false },
      { topic: "保育料", queries: ["保育料 助成"], web: false },
    ]);

    expect(searchedQueries()).toEqual(["出産祝い金", "保育料 助成"]);
    expect(materials).toBe(
      [
        "## 観点: 出産祝い金\n【1】",
        "## 観点: 保育料\n【2】",
        "## 村の資料\n【1】\n祝い金は10万円\n\n【2】\n保育料は無料",
      ].join("\n\n"),
    );
    expect(decideMock).not.toHaveBeenCalled();
    expect(webGenerate).not.toHaveBeenCalled();
  });

  it("観点の検索語が複数なら並列に引き、スコア順に重複を除いて観点あたりの上限に絞る", async () => {
    searchMock
      .mockResolvedValueOnce(hits(["A", 0.5], ["B", 0.9], ["C", 0.7]))
      .mockResolvedValueOnce(hits(["B", 0.9], ["D", 0.8], ["E", 0.6]));

    const materials = await run(
      "国保の保険料は？",
      [
        {
          topic: "国保の保険料",
          queries: ["国保", "国民健康保険"],
          web: false,
        },
      ],
      3,
    );

    expect(searchedQueries()).toEqual(["国保", "国民健康保険"]);
    expect(materials).toContain("## 観点: 国保の保険料\n【1】【2】【3】");
    expect(materials).toContain("【1】\nB\n\n【2】\nD\n\n【3】\nC");
    expect(materials).not.toContain("\nA");
  });

  it("観点をまたいで同じ資料が出たら 1 回だけ載せる", async () => {
    searchMock
      .mockResolvedValueOnce(hit("共通の資料"))
      .mockResolvedValueOnce(hits(["共通の資料", 0.9], ["別の資料", 0.8]));

    const materials = await run("q", [
      { topic: "観点1", queries: ["a"], web: false },
      { topic: "観点2", queries: ["b"], web: false },
    ]);

    expect(materials).toContain("## 観点: 観点1\n【1】");
    expect(materials).toContain("## 観点: 観点2\n【1】【2】");
    expect(materials.match(/共通の資料/g)).toHaveLength(1);
  });

  it("資料が見つからない観点は該当なしと示す", async () => {
    const materials = await run("q", [
      { topic: "寮費", queries: ["寮費"], web: false },
    ]);

    expect(materials).toBe(
      "## 観点: 寮費\n村の資料に該当なし\n\n## 村の資料\n該当なし",
    );
  });

  it("web を付けた観点は村の資料も引きつつ、まとめて 1 回の Web 検索で補う", async () => {
    searchMock
      .mockResolvedValueOnce(hit("村の行事予定"))
      .mockResolvedValueOnce({ results: [] });
    webGenerate.mockResolvedValueOnce({ text: "開催は11月9日" });

    const materials = await run("今週のイベントと天気は？", [
      { topic: "今週のイベント", queries: ["イベント"], web: true },
      { topic: "今日の天気", queries: ["天気"], web: true },
    ]);

    expect(searchedQueries()).toEqual(["イベント", "天気"]);
    expect(webGenerate).toHaveBeenCalledTimes(1);
    expect(webGenerate.mock.calls[0]?.[0]).toBe(
      "ユーザーの質問: 今週のイベントと天気は？\n\n調べる観点: 今週のイベント / 今日の天気\n上の観点だけを調べる。",
    );
    expect(materials).toContain(
      "## 観点: 今週のイベント（Web でも調べた）\n【1】",
    );
    expect(materials).toContain(
      "## 観点: 今日の天気（Web でも調べた）\n村の資料に該当なし",
    );
    expect(materials).toContain("## Web 検索\n開催は11月9日");
  });

  it("web が無い観点だけ jev に聞き、P(village) 0.3 未満を Web に回す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.1));
    webGenerate.mockResolvedValueOnce({ text: "晴れ" });

    const materials = await run("q", [
      { topic: "寮費", queries: ["寮費"] },
      { topic: "天気", queries: ["天気"] },
      { topic: "指定済み", queries: ["x"], web: false },
    ]);

    expect(decideMock).toHaveBeenCalledTimes(1);
    expect(decideMock.mock.calls[0]?.[2]).toMatchObject({
      question: "q",
      aspects: [
        { id: "a0", topic: "寮費" },
        { id: "a1", topic: "天気" },
      ],
    });
    expect(Object.keys(decideMock.mock.calls[0]?.[3])).toEqual(["a0", "a1"]);
    expect(webGenerate.mock.calls[0]?.[0]).toContain("調べる観点: 天気\n");
    expect(materials).toContain("## 観点: 天気（Web でも調べた）");
    expect(materials).toContain("## 観点: 寮費\n");
  });

  it("判定を待たずに村の資料を引き始める", async () => {
    let settle!: () => void;
    decideMock.mockReturnValueOnce(
      new Promise<ReturnType<typeof routes>>((resolve) => {
        settle = () => resolve(routes(0.9));
      }),
    );
    const pending = run("q", [{ topic: "寮費", queries: ["寮費"] }]);
    await vi.waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(webGenerate).not.toHaveBeenCalled();
    settle();
    await pending;
  });

  it("判定が得られないときは web 無しの観点を村だけで調べる", async () => {
    decideMock.mockResolvedValueOnce(undefined);
    await run("q", [{ topic: "天気", queries: ["天気"] }]);
    expect(webGenerate).not.toHaveBeenCalled();
    expect(searchedQueries()).toEqual(["天気"]);
  });

  it("配信は全観点の検索語をまとめて 1 回だけ引き、新しい順の節として返す", async () => {
    findBroadcastsMock.mockResolvedValueOnce([
      { title: "除雪のお知らせ", body: "明日から", sentAt: "2026-11-01" },
    ]);

    const materials = await run("q", [
      { topic: "除雪", queries: ["除雪", "排雪"], web: false },
      { topic: "ごみ", queries: ["ごみ"], web: false },
    ]);

    expect(findBroadcastsMock).toHaveBeenCalledTimes(1);
    expect(findBroadcastsMock.mock.calls[0]?.[1]).toBe("除雪 排雪 ごみ");
    expect(materials).toContain(
      "## 村の LINE 配信（新しい順）\n【配信1】除雪のお知らせ [2026-11-01]\n明日から",
    );
  });
});
