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

const run = async (question: string, aspects: AspectSpec[]) =>
  JSON.parse(
    await research({ question, aspects }, { requestContext: requestContext() }),
  );

const contentsOf = (results: { content: string }[]) =>
  results.map((r) => r.content);

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

const foundFor = (byQuery: Record<string, ReturnType<typeof hits>>) =>
  searchMock.mockImplementation(
    async (query: string) => byQuery[query] ?? { results: [] },
  );

beforeEach(() => {
  webGenerate.mockReset().mockResolvedValue({ text: "" });
  decideMock.mockReset().mockResolvedValue(undefined);
  searchMock.mockReset().mockResolvedValue({ results: [] });
  findBroadcastsMock.mockReset().mockResolvedValue([]);
});

describe("research", () => {
  it("観点ごとに村の資料を引き、観点ごとの結果として JSON で返す", async () => {
    searchMock.mockImplementation(async (query: string) =>
      query === "出産祝い金"
        ? {
            results: [
              {
                content: "祝い金は10万円",
                score: 0.9,
                source: "doc",
                title: "子育て支援",
                section: "出産",
                url: "https://example.com/kosodate",
                date: "2026-04-01",
                dateType: "published",
              },
            ],
          }
        : { results: [] },
    );

    const materials = await run("子どもが生まれた。支援は？", [
      { topic: "出産祝い金", queries: ["出産祝い金"], web: false },
      { topic: "保育料", queries: ["保育料 助成"], web: false },
    ]);

    expect(searchedQueries()).toEqual([
      "出産祝い金",
      "保育料 助成",
      "保育料",
      "子どもが生まれた。支援は？",
    ]);
    expect(materials).toEqual({
      aspects: [
        {
          topic: "出産祝い金",
          web: false,
          results: [
            {
              title: "子育て支援",
              section: "出産",
              url: "https://example.com/kosodate",
              date: "2026-04-01",
              dateType: "published",
              content: "祝い金は10万円",
            },
          ],
        },
        { topic: "保育料", web: false, results: [] },
      ],
      question: { text: "子どもが生まれた。支援は？", results: [] },
      broadcasts: [],
      web: "",
    });
    expect(decideMock).not.toHaveBeenCalled();
    expect(webGenerate).not.toHaveBeenCalled();
  });

  it("観点の検索語が複数なら並列に引き、スコア順に重複を除いて返す", async () => {
    foundFor({
      国保: hits(["A", 0.5], ["B", 0.9], ["C", 0.7]),
      国民健康保険: hits(["B", 0.9], ["D", 0.8]),
    });

    const materials = await run("国保の保険料は？", [
      {
        topic: "国保の保険料",
        queries: ["国保", "国民健康保険"],
        web: false,
      },
    ]);

    expect(searchedQueries()).toEqual([
      "国保",
      "国民健康保険",
      "国保の保険料",
      "国保の保険料は？",
    ]);
    expect(contentsOf(materials.aspects[0].results)).toEqual([
      "B",
      "D",
      "C",
      "A",
    ]);
  });

  it("前の観点で出た資料は後ろの観点に重ねて載せない", async () => {
    foundFor({
      a: hit("共通の資料"),
      b: hits(["共通の資料", 0.9], ["別の資料", 0.8]),
    });

    const materials = await run("q", [
      { topic: "観点1", queries: ["a"], web: false },
      { topic: "観点2", queries: ["b"], web: false },
    ]);

    expect(contentsOf(materials.aspects[0].results)).toEqual(["共通の資料"]);
    expect(contentsOf(materials.aspects[1].results)).toEqual(["別の資料"]);
  });

  it("web を付けた観点は村の資料も引きつつ、まとめて 1 回の Web 検索で補う", async () => {
    foundFor({ イベント: hit("村の行事予定") });
    webGenerate.mockResolvedValueOnce({ text: "開催は11月9日" });

    const materials = await run("今週のイベントと天気は？", [
      { topic: "今週のイベント", queries: ["イベント"], web: true },
      { topic: "今日の天気", queries: ["天気"], web: true },
    ]);

    expect(searchedQueries()).toEqual([
      "イベント",
      "今週のイベント",
      "天気",
      "今日の天気",
      "今週のイベントと天気は？",
    ]);
    expect(webGenerate).toHaveBeenCalledTimes(1);
    expect(webGenerate.mock.calls[0]?.[0]).toBe(
      "ユーザーの質問: 今週のイベントと天気は？\n\n調べる観点: 今週のイベント / 今日の天気\n上の観点だけを調べる。",
    );
    expect(materials.aspects).toEqual([
      {
        topic: "今週のイベント",
        web: true,
        results: [{ content: "村の行事予定" }],
      },
      { topic: "今日の天気", web: true, results: [] },
    ]);
    expect(materials.web).toBe("開催は11月9日");
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
    expect(
      materials.aspects.map((a: { topic: string; web: boolean }) => [
        a.topic,
        a.web,
      ]),
    ).toEqual([
      ["寮費", false],
      ["天気", true],
      ["指定済み", false],
    ]);
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
    expect(searchedQueries()).toEqual(["天気", "q"]);
  });

  it("質問文でも引き、観点で出ていない資料を質問文の結果として返す", async () => {
    foundFor({
      寮費: hit("寮費は3万円"),
      "寮費はどこで確認できる？": hits(
        ["案内ページ", 0.9],
        ["寮費は3万円", 0.8],
        ["募集要項", 0.7],
      ),
    });

    const materials = await run("寮費はどこで確認できる？", [
      { topic: "寮費", queries: ["寮費"], web: false },
    ]);

    expect(contentsOf(materials.aspects[0].results)).toEqual(["寮費は3万円"]);
    expect(materials.question.text).toBe("寮費はどこで確認できる？");
    expect(contentsOf(materials.question.results)).toEqual([
      "案内ページ",
      "募集要項",
    ]);
  });

  it("質問文が検索語と同じなら重ねて引かず、質問文の結果も出さない", async () => {
    foundFor({ 今日の天気: hit("晴れ") });

    const materials = await run("今日の天気", [
      { topic: "今日の天気", queries: ["今日の天気"], web: false },
    ]);

    expect(searchedQueries()).toEqual(["今日の天気"]);
    expect(materials.question).toBeUndefined();
  });

  it("配信は全観点の検索語をまとめて 1 回だけ引いて返す", async () => {
    findBroadcastsMock.mockResolvedValueOnce([
      { title: "除雪のお知らせ", body: "明日から", sentAt: "2026-11-01" },
    ]);

    const materials = await run("q", [
      { topic: "除雪", queries: ["除雪", "排雪"], web: false },
      { topic: "ごみ", queries: ["ごみ"], web: false },
    ]);

    expect(findBroadcastsMock).toHaveBeenCalledTimes(1);
    expect(findBroadcastsMock.mock.calls[0]?.[1]).toBe("除雪 排雪 ごみ");
    expect(materials.broadcasts).toEqual([
      { title: "除雪のお知らせ", sentAt: "2026-11-01", body: "明日から" },
    ]);
  });
});
