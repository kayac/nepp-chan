import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  memoGenerate,
  webGenerate,
  decideMock,
  createDeciderMock,
  searchMock,
  findBroadcastsMock,
} = vi.hoisted(() => ({
  memoGenerate: vi.fn(),
  webGenerate: vi.fn(),
  decideMock: vi.fn(),
  createDeciderMock: vi.fn(),
  searchMock: vi.fn(),
  findBroadcastsMock: vi.fn(),
}));

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: { findByKeyword: findBroadcastsMock },
}));

vi.mock("~/services/knowledge/search", () => ({
  searchKnowledge: searchMock,
}));

vi.mock("~/services/decision/decider", () => ({
  createDecider: createDeciderMock,
}));

vi.mock("~/mastra/agents/knowledge-memo-agent", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/mastra/agents/knowledge-memo-agent")
  >()),
  knowledgeMemoAgent: { generate: memoGenerate },
}));

vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  webResearcherAgent: { generate: webGenerate },
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runResearch } = await import("./research-workflow");

const requestContext = () => {
  const ctx = new RequestContext();
  ctx.set("env", {
    VECTORIZE: {} as VectorizeIndex,
    GOOGLE_GENERATIVE_AI_API_KEY: "g",
  });
  ctx.set("db", {} as D1Database);
  return ctx;
};

const input = (
  question: string,
  ...aspects: [topic: string, ...queries: string[]][]
) => ({
  question,
  aspects: aspects.map(([topic, ...queries]) => ({ topic, queries })),
});

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

const memo = (
  text: string,
  aspects: {
    topic: string;
    coverage: "取れた" | "一部" | "取れない";
    retryQuery?: string;
  }[],
) => ({ object: { memo: text, aspects }, text });

const hit = (content: string) => ({
  results: [{ content, score: 0.9, source: "doc" }],
});

const searchedQueries = () => searchMock.mock.calls.map((c) => c[0]);

beforeEach(() => {
  memoGenerate.mockReset();
  webGenerate.mockReset();
  decideMock.mockReset();
  createDeciderMock.mockReset().mockReturnValue({ decide: decideMock });
  searchMock.mockReset().mockResolvedValue({ results: [] });
  findBroadcastsMock.mockReset().mockResolvedValue([]);
});

describe("runResearch", () => {
  it("村の観点が全部取れたら、ナレッジだけで 1 回で調査メモを返す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9));
    searchMock.mockResolvedValueOnce(hit("月額30,000円"));
    memoGenerate.mockResolvedValueOnce(
      memo("寮費は月額30,000円", [{ topic: "寮費", coverage: "取れた" }]),
    );

    const result = await runResearch({
      input: input("寮費は？", ["寮費", "寮費"]),
      requestContext: requestContext(),
    });

    expect(result.memo).toBe("### 村のナレッジ\n寮費は月額30,000円");
    expect(searchedQueries()).toEqual(["寮費"]);
    expect(memoGenerate).toHaveBeenCalledTimes(1);
    expect(webGenerate).not.toHaveBeenCalled();
  });

  it("観点ごとに並列で検索し、検索結果は観点ごとにまとめてメモ担当に渡す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    searchMock
      .mockResolvedValueOnce(hit("祝い金は10万円"))
      .mockResolvedValueOnce(hit("保育料は無料"));
    memoGenerate.mockResolvedValueOnce(
      memo("メモ", [
        { topic: "出産祝い金", coverage: "取れた" },
        { topic: "保育料", coverage: "取れた" },
      ]),
    );

    await runResearch({
      input: input(
        "子どもが生まれた。支援は？",
        ["出産祝い金", "出産祝い金"],
        ["保育料", "保育料 助成"],
      ),
      requestContext: requestContext(),
    });

    expect(searchedQueries()).toEqual(["出産祝い金", "保育料 助成"]);
    const prompt = memoGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("## 観点: 出産祝い金\n【1】");
    expect(prompt).toContain("## 観点: 保育料\n【2】");
    expect(prompt).toContain(
      "## 資料\n【1】\n祝い金は10万円\n\n【2】\n保育料は無料",
    );
  });

  it("観点の検索語が複数なら並列に引き、スコア順に重複を除いて観点あたり 5 件に絞る", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9));
    searchMock
      .mockResolvedValueOnce({
        results: [
          { content: "共通", score: 0.5, source: "doc" },
          { content: "国保だけ", score: 0.4, source: "doc" },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { content: "共通", score: 0.5, source: "doc" },
          { content: "正式名称だけ", score: 0.9, source: "doc" },
        ],
      });
    memoGenerate.mockResolvedValueOnce(
      memo("m", [{ topic: "国保", coverage: "取れた" }]),
    );

    await runResearch({
      input: input("国保はいくら？", ["国保", "国保", "国民健康保険"]),
      requestContext: requestContext(),
    });

    expect(searchedQueries()).toEqual(["国保", "国民健康保険"]);
    expect(memoGenerate.mock.calls[0]?.[0]).toContain(
      "## 資料\n【1】\n正式名称だけ\n\n【2】\n共通\n\n【3】\n国保だけ",
    );
  });

  it("観点をまたいで同じ資料が出たら 1 回だけ載せ、観点からは番号で参照する", async () => {
    searchMock.mockResolvedValue(hit("共通の資料"));
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    memoGenerate.mockResolvedValueOnce(
      memo("m", [
        { topic: "a", coverage: "取れた" },
        { topic: "b", coverage: "取れた" },
      ]),
    );

    await runResearch({
      input: input("q", ["a", "qa"], ["b", "qb"]),
      requestContext: requestContext(),
    });

    const prompt = memoGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("## 観点: a\n【1】");
    expect(prompt).toContain("## 観点: b\n【1】");
    expect(prompt.match(/共通の資料/g)).toHaveLength(1);
  });

  it("取れない観点だけを言い換え検索語で引き直し、2 回目で止める", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    memoGenerate
      .mockResolvedValueOnce(
        memo("1 回目", [
          {
            topic: "国保税",
            coverage: "取れない",
            retryQuery: "国民健康保険税",
          },
          { topic: "納期", coverage: "取れた" },
        ]),
      )
      .mockResolvedValueOnce(
        memo("2 回目", [
          {
            topic: "国保税",
            coverage: "取れない",
            retryQuery: "国民健康保険 税率",
          },
          { topic: "納期", coverage: "取れた" },
        ]),
      );
    webGenerate.mockResolvedValueOnce({ text: "w" });

    const result = await runResearch({
      input: input("国保税はいくら？", ["国保税", "国保税"], ["納期", "納期"]),
      requestContext: requestContext(),
    });

    expect(searchedQueries()).toEqual(["国保税", "納期", "国民健康保険税"]);
    expect(memoGenerate).toHaveBeenCalledTimes(2);
    expect(result.memo).toContain("2 回目");
    expect(webGenerate.mock.calls[0]?.[0]).toContain("調べる観点: 国保税");
  });

  it("引き直しのメモ書きが取れた観点を返し漏らしても、前回の取れ具合を保って Web に回さない", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    memoGenerate
      .mockResolvedValueOnce(
        memo("1", [
          { topic: "a", coverage: "取れない", retryQuery: "a2" },
          { topic: "b", coverage: "取れた" },
        ]),
      )
      .mockResolvedValueOnce(memo("2", [{ topic: "a", coverage: "取れた" }]));

    const result = await runResearch({
      input: input("q", ["a", "qa"], ["b", "qb"]),
      requestContext: requestContext(),
    });

    expect(webGenerate).not.toHaveBeenCalled();
    expect(result.memo).toBe("### 村のナレッジ\n2");
  });

  it("一部なら引き直さず、言い換え検索語が無い取れないも引き直さない", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    memoGenerate.mockResolvedValueOnce(
      memo("粗大ごみは10月", [
        { topic: "粗大ごみ", coverage: "一部", retryQuery: "粗大ごみ 収集" },
        { topic: "手数料", coverage: "取れない" },
      ]),
    );

    webGenerate.mockResolvedValueOnce({ text: "w" });
    const result = await runResearch({
      input: input(
        "粗大ごみはいつ？",
        ["粗大ごみ", "粗大ごみ"],
        ["手数料", "手数料"],
      ),
      requestContext: requestContext(),
    });

    expect(memoGenerate).toHaveBeenCalledTimes(1);
    expect(result.memo).toContain("粗大ごみは10月");
  });

  it("引き直しで見つかった結果は前回の結果に足す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9));
    searchMock
      .mockResolvedValueOnce(hit("古い資料"))
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce(hit("税率は 8%"));
    memoGenerate
      .mockResolvedValueOnce(
        memo("1", [
          {
            topic: "国保税",
            coverage: "取れない",
            retryQuery: "国民健康保険税",
          },
          { topic: "納期", coverage: "取れた" },
        ]),
      )
      .mockResolvedValueOnce(
        memo("2", [
          { topic: "国保税", coverage: "取れた" },
          { topic: "納期", coverage: "取れた" },
        ]),
      );

    await runResearch({
      input: input("q", ["国保税", "国保税"], ["納期", "納期"]),
      requestContext: requestContext(),
    });

    const prompt = memoGenerate.mock.calls[1]?.[0] as string;
    expect(prompt).toContain("前回の調査メモ:\n1");
    expect(prompt).toContain("## 観点: 国保税\n【1】【2】");
    expect(prompt).toContain("古い資料");
    expect(prompt).toContain("税率は 8%");
    expect(prompt).not.toContain("## 観点: 納期");
    expect(prompt).toContain("取れ具合は全部の観点（国保税 / 納期）に付ける");
  });

  it("取れない観点があれば、その観点だけを Web で調べてメモに足す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    memoGenerate.mockResolvedValueOnce(
      memo("天塩川温泉に泊まれる", [
        { topic: "宿泊施設", coverage: "取れた" },
        { topic: "近隣の小児科", coverage: "取れない" },
      ]),
    );
    webGenerate.mockResolvedValueOnce({ text: "名寄市立総合病院に小児科" });

    const result = await runResearch({
      input: input("q", ["宿泊施設", "宿泊施設"], ["近隣の小児科", "小児科"]),
      requestContext: requestContext(),
    });

    const prompt = webGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("調べる観点: 近隣の小児科");
    expect(prompt).not.toContain("調べる観点: 宿泊施設");
    expect(prompt).toContain("天塩川温泉に泊まれる");
    expect(result.memo).toBe(
      "### 村のナレッジ\n天塩川温泉に泊まれる\n\n### Web 検索\n名寄市立総合病院に小児科",
    );
  });

  it("村外の観点はナレッジを引かず Web で調べ、村の観点はナレッジで調べる", async () => {
    decideMock.mockResolvedValueOnce(routes(0.1, 0.9));
    searchMock.mockResolvedValueOnce(hit("バス時刻表"));
    memoGenerate.mockResolvedValueOnce(
      memo("バスは 8 時", [{ topic: "地域バスの時刻", coverage: "取れた" }]),
    );
    webGenerate.mockResolvedValueOnce({ text: "平常運行" });

    const result = await runResearch({
      input: input(
        "q",
        ["列車の運行状況", "宗谷本線 運行"],
        ["地域バスの時刻", "地域バス"],
      ),
      requestContext: requestContext(),
    });

    expect(searchedQueries()).toEqual(["地域バス"]);
    const prompt = memoGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("バス時刻表");
    expect(prompt).not.toContain("## 観点: 列車の運行状況");
    expect(webGenerate.mock.calls[0]?.[0]).toContain(
      "調べる観点: 列車の運行状況",
    );
    expect(result.memo).toContain("バスは 8 時");
    expect(result.memo).toContain("平常運行");
  });

  it("全部村外なら、ナレッジも配信もメモ担当も呼ばずに Web だけで調べる", async () => {
    decideMock.mockResolvedValueOnce(routes(0.1));
    webGenerate.mockResolvedValueOnce({ text: "晴れ" });

    const result = await runResearch({
      input: input("明日の天気は？", ["天気", "天気"]),
      requestContext: requestContext(),
    });

    expect(searchMock).not.toHaveBeenCalled();
    expect(findBroadcastsMock).not.toHaveBeenCalled();
    expect(memoGenerate).not.toHaveBeenCalled();
    expect(result.memo).toBe("### Web 検索\n晴れ");
  });

  it("村の判定は観点ごとに 1 回の jev 呼び出しで聞き、P(village) 0.3 以上を村とする", async () => {
    decideMock.mockResolvedValueOnce(routes(0.3, 0.29));
    memoGenerate.mockResolvedValueOnce(
      memo("m", [{ topic: "a", coverage: "取れた" }]),
    );
    webGenerate.mockResolvedValueOnce({ text: "w" });

    await runResearch({
      input: input("q", ["a", "a"], ["b", "b"]),
      requestContext: requestContext(),
    });

    expect(decideMock).toHaveBeenCalledTimes(1);
    const [state, questions] = decideMock.mock.calls[0] ?? [];
    expect(state).toEqual({
      instructions: expect.stringContaining("迷ったら village"),
      question: "q",
      aspects: [
        { id: "a0", topic: "a" },
        { id: "a1", topic: "b" },
      ],
    });
    expect(Object.keys(questions)).toEqual(["a0", "a1"]);
    expect(questions.a1.instructions).toContain("id が a1");
    expect(searchedQueries()).toEqual(["a"]);
  });

  it("jev が使えない・失敗したときは全部村として扱う", async () => {
    memoGenerate.mockResolvedValue(
      memo("m", [{ topic: "天気", coverage: "取れた" }]),
    );

    createDeciderMock.mockReturnValueOnce(undefined);
    await runResearch({
      input: input("q", ["天気", "天気"]),
      requestContext: requestContext(),
    });
    decideMock.mockRejectedValueOnce(new Error("timeout"));
    await runResearch({
      input: input("q", ["天気", "天気"]),
      requestContext: requestContext(),
    });

    expect(searchedQueries()).toEqual(["天気", "天気"]);
    expect(webGenerate).not.toHaveBeenCalled();
  });

  it("メモ担当の構造化出力が取れなければ本文をメモにし、観点は取れない扱いで Web に回す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9));
    memoGenerate.mockResolvedValueOnce({
      object: undefined,
      text: "寮費は3万円",
    });
    webGenerate.mockResolvedValueOnce({ text: "補足" });

    const result = await runResearch({
      input: input("寮費は？", ["寮費", "寮費"]),
      requestContext: requestContext(),
    });

    expect(memoGenerate).toHaveBeenCalledTimes(1);
    expect(result.memo).toContain("寮費は3万円");
    expect(result.memo).toContain("補足");
  });

  it("配信は最初に検索語をまとめて 1 回だけ引き、最初のメモ書きにだけ渡す", async () => {
    decideMock.mockResolvedValueOnce(routes(0.9, 0.9));
    findBroadcastsMock.mockResolvedValueOnce([
      { title: "お知らせ", body: "本文", sentAt: "2026-10-01" },
    ]);
    memoGenerate
      .mockResolvedValueOnce(
        memo("1", [
          { topic: "a", coverage: "取れない", retryQuery: "a2" },
          { topic: "b", coverage: "取れた" },
        ]),
      )
      .mockResolvedValueOnce(
        memo("2", [
          { topic: "a", coverage: "取れた" },
          { topic: "b", coverage: "取れた" },
        ]),
      );

    await runResearch({
      input: input("q", ["a", "qa"], ["b", "qb"]),
      requestContext: requestContext(),
    });

    expect(findBroadcastsMock).toHaveBeenCalledTimes(1);
    expect(findBroadcastsMock.mock.calls[0]?.[1]).toBe("qa qb");
    expect(memoGenerate.mock.calls[0]?.[0]).toContain(
      "【配信1】お知らせ [2026-10-01]\n本文",
    );
    expect(memoGenerate.mock.calls[1]?.[0]).not.toContain("【配信1】");
  });
});
