import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentConfigs } = vi.hoisted(() => ({
  agentConfigs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(config: Record<string, unknown>) {
      agentConfigs.push(config);
    }

    generate = vi.fn();
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => ({
    textEmbeddingModel: vi.fn(() => ({ id: "fake-embedding-model" })),
  })),
}));

vi.mock("@mastra/rag", () => ({
  rerankWithScorer: vi.fn(),
}));

vi.mock("ai", () => ({
  embed: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/services/knowledge/retrieval-trace", () => ({
  recordRetrievalRunInBackground: vi.fn(),
}));

vi.mock("~/services/knowledge/corrections", () => ({
  applyCorrections: vi.fn(),
}));

const { embed } = await import("ai");
const { rerankWithScorer } = await import("@mastra/rag");
const { logger } = await import("~/lib/logger");
const { recordRetrievalRunInBackground } = await import(
  "~/services/knowledge/retrieval-trace"
);
const { applyCorrections } = await import("~/services/knowledge/corrections");
const { searchKnowledge } = await import("./search");

const buildVectorize = () =>
  ({
    query: vi.fn(),
    upsert: vi.fn(),
    deleteByIds: vi.fn(),
  }) as unknown as VectorizeIndex;

beforeEach(() => {
  vi.mocked(embed).mockReset();
  vi.mocked(rerankWithScorer).mockReset();
  vi.mocked(logger.error).mockReset();
  vi.mocked(recordRetrievalRunInBackground).mockReset();
  vi.mocked(applyCorrections).mockReset();
});

describe("searchKnowledge", () => {
  it("reranker は Luna の reasoning none を使う", () => {
    const config = agentConfigs.find(
      (candidate) => candidate.id === "relevance-scorer-knowledge-reranker",
    );
    if (!config) throw new Error("reranker Agent が構築されていない");
    const defaultOptions = (
      config.defaultOptions as (args: Record<string, unknown>) => {
        providerOptions: { openai: { reasoningEffort: string } };
      }
    )({});

    expect(config.model).toBe("openai/gpt-5.6-luna");
    expect(defaultOptions.providerOptions.openai.reasoningEffort).toBe("none");
  });

  it("matches が無ければ空配列を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches: [] } as never);

    const result = await searchKnowledge("foo", vectorize, "key");
    expect(result).toEqual({ results: [] });
    expect(rerankWithScorer).not.toHaveBeenCalled();
  });

  it("matches を rerank に渡し、整形された結果を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [
        {
          id: "v1",
          score: 0.8,
          metadata: {
            content: "本文1",
            source: "doc.md",
            title: "Tタイトル",
            section: "Sセク",
            subsection: "Sub",
            url: "https://example.com",
            date: "2030-01-01",
            date_type: "event",
          },
        },
      ],
    } as never);

    vi.mocked(rerankWithScorer).mockResolvedValueOnce([
      {
        score: 0.95,
        result: {
          id: "v1",
          score: 0.8,
          metadata: {
            content: "本文1",
            source: "doc.md",
            title: "Tタイトル",
            section: "Sセク",
            subsection: "Sub",
            url: "https://example.com",
            date: "2030-01-01",
            dateType: "event",
          },
        },
      },
    ] as never);

    const result = await searchKnowledge("クエリ", vectorize, "key");

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual({
      content: "本文1",
      score: 0.95,
      source: "doc.md",
      title: "Tタイトル",
      section: "Sセク",
      subsection: "Sub",
      url: "https://example.com",
      date: "2030-01-01",
      dateType: "event",
    });

    const rerankArg = vi.mocked(rerankWithScorer).mock
      .calls[0]?.[0] as unknown as {
      query: string;
      results: { metadata: { source: string } }[];
    };
    expect(rerankArg.query).toBe("クエリ");
    expect(rerankArg.results[0].metadata.source).toBe("doc.md");
  });

  it("requestContext に db があれば訂正を適用した結果を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.8, metadata: { content: "本文1" } }],
    } as never);
    vi.mocked(rerankWithScorer).mockResolvedValueOnce([
      {
        score: 0.95,
        result: { id: "v1", score: 0.8, metadata: { source: "doc.md" } },
      },
    ] as never);
    const corrected = [
      { content: "訂正", score: 1, source: "curated/corrections/cor-1.md" },
    ];
    vi.mocked(applyCorrections).mockResolvedValueOnce(corrected as never);

    const d1 = {} as D1Database;
    const requestContext = {
      get: (key: string) => (key === "db" ? d1 : undefined),
    } as never;

    const result = await searchKnowledge("q", vectorize, "key", requestContext);

    expect(applyCorrections).toHaveBeenCalledWith(d1, expect.any(Array));
    expect(result.results).toBe(corrected);
  });

  it("db が無ければ訂正を適用しない", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.8, metadata: { content: "本文1" } }],
    } as never);
    vi.mocked(rerankWithScorer).mockResolvedValueOnce([
      {
        score: 0.95,
        result: { id: "v1", score: 0.8, metadata: { source: "doc.md" } },
      },
    ] as never);

    await searchKnowledge("q", vectorize, "key");

    expect(applyCorrections).not.toHaveBeenCalled();
  });

  it("rerank 後の hits をトレースに記録する", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.8, metadata: { content: "本文1" } }],
    } as never);
    vi.mocked(rerankWithScorer).mockResolvedValueOnce([
      {
        score: 0.95,
        result: {
          id: "v1",
          score: 0.8,
          metadata: {
            content: "本文1",
            source: "doc.md",
            title: "Tタイトル",
            section: "Sセク",
            contentHash: "hash1",
          },
        },
      },
    ] as never);

    await searchKnowledge("クエリ", vectorize, "key");

    expect(recordRetrievalRunInBackground).toHaveBeenCalledWith(undefined, {
      query: "クエリ",
      hits: [
        {
          source: "doc.md",
          title: "Tタイトル",
          section: "Sセク",
          score: 0.8,
          rerankScore: 0.95,
          contentHash: "hash1",
        },
      ],
      durationMs: expect.any(Number),
    });
  });

  it("0 件の検索も hits 空配列でトレースに記録する", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [],
    } as never);

    await searchKnowledge("見つからないクエリ", vectorize, "key");

    expect(recordRetrievalRunInBackground).toHaveBeenCalledWith(undefined, {
      query: "見つからないクエリ",
      hits: [],
      durationMs: expect.any(Number),
    });
  });

  it("metadata 欠落フィールドは unknown / 空文字で埋める", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.7, metadata: undefined }],
    } as never);

    vi.mocked(rerankWithScorer).mockResolvedValueOnce([
      {
        score: 0.5,
        result: { id: "v1", score: 0.7, metadata: {} },
      },
    ] as never);

    const result = await searchKnowledge("q", vectorize, "key");
    expect(result.results[0]).toMatchObject({
      content: "",
      source: "unknown",
    });
  });

  it("embed が失敗したら error を返し results は空", async () => {
    vi.mocked(embed).mockRejectedValueOnce(new Error("quota exceeded"));

    const result = await searchKnowledge("q", buildVectorize(), "key");

    expect(result).toEqual({ results: [], error: "quota exceeded" });
    expect(logger.error).toHaveBeenCalled();
  });

  it("vectorize.query が失敗してもエラーハンドリングする", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockRejectedValueOnce("non-error throw");

    const result = await searchKnowledge("q", vectorize, "key");
    expect(result.error).toBe("Unknown error");
  });

  it("rerank の topK / weights を指定して呼ぶ", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.5, metadata: { content: "x" } }],
    } as never);
    vi.mocked(rerankWithScorer).mockResolvedValueOnce([] as never);

    await searchKnowledge("q", vectorize, "key");

    const arg = vi.mocked(rerankWithScorer).mock.calls[0]?.[0] as {
      options: { topK: number; weights: Record<string, number> };
    };
    expect(arg.options.topK).toBe(5);
    expect(arg.options.weights).toEqual({
      semantic: 0.5,
      vector: 0.3,
      position: 0.2,
    });
  });
});
