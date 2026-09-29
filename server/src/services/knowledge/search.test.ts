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

const { embed } = await import("ai");
const { rerankWithScorer } = await import("@mastra/rag");
const { logger } = await import("~/lib/logger");
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
});

describe("searchKnowledge", () => {
  it("matches が無ければ空配列を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches: [] } as never);

    const result = await searchKnowledge("foo", vectorize, "key");
    expect(result).toEqual({ results: [] });
    expect(rerankWithScorer).not.toHaveBeenCalled();
  });

  it("matches を rerank に渡し、rerank スコアに新しさを加点して返す", async () => {
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
            date: "2999-01-01",
            date_type: "exact",
          },
        },
      ],
    } as never);

    vi.mocked(rerankWithScorer).mockImplementationOnce(async ({ results }) => [
      {
        score: 0.95,
        result: results[0],
        details: { semantic: 0, vector: 0, position: 0 },
      },
    ]);

    const result = await searchKnowledge("クエリ", vectorize, "key");

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      content: "本文1",
      source: "doc.md",
      title: "Tタイトル",
      section: "Sセク",
      subsection: "Sub",
      url: "https://example.com",
      date: "2999-01-01",
      dateType: "exact",
    });
    expect(result.results[0].score).toBeCloseTo((0.95 + 0.15) / 1.15, 5);

    const rerankArg = vi.mocked(rerankWithScorer).mock
      .calls[0]?.[0] as unknown as {
      query: string;
      results: { metadata: { source: string } }[];
      options: { topK: number };
    };
    expect(rerankArg.query).toBe("クエリ");
    expect(rerankArg.results[0].metadata.source).toBe("doc.md");
    expect(rerankArg.options.topK).toBe(1);
  });

  it("vector 候補は新しさ込みで上位 10 件に絞り、vector スコア順で rerank に渡す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    const oldMatches = Array.from({ length: 10 }, (_, i) => ({
      id: `old${i}`,
      score: 0.72 - i * 0.001,
      metadata: {
        content: `古い${i}`,
        source: `old${i}.md`,
        date: "2020-01-01",
        date_type: "exact",
      },
    }));
    const newest = {
      id: "new",
      score: 0.7,
      metadata: {
        content: "新しい",
        source: "new.md",
        date: "2999-01-01",
        date_type: "exact",
      },
    };
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [...oldMatches, newest],
    } as never);
    vi.mocked(rerankWithScorer).mockImplementationOnce(async ({ results }) =>
      results.map((r) => ({
        score: r.score,
        result: r,
        details: { semantic: 0, vector: 0, position: 0 },
      })),
    );

    await searchKnowledge("q", vectorize, "key");

    const rerankArg = vi.mocked(rerankWithScorer).mock
      .calls[0]?.[0] as unknown as {
      results: { id: string }[];
      options: { topK: number };
    };
    expect(rerankArg.results).toHaveLength(10);
    expect(rerankArg.results.map((r) => r.id)).toContain("new");
    expect(rerankArg.results.map((r) => r.id)).not.toContain("old9");
    expect(rerankArg.results[0].id).toBe("old0");
    expect(rerankArg.results[9].id).toBe("new");
    expect(rerankArg.options.topK).toBe(10);
  });

  it("rerank 後は新しさを加点して並べ替え、上位 5 件を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    const matches = Array.from({ length: 6 }, (_, i) => ({
      id: `v${i}`,
      score: 0.8 - i * 0.01,
      metadata: {
        content: `c${i}`,
        source: `s${i}.md`,
        date: i === 5 ? "2999-01-01" : "2020-01-01",
        date_type: "exact",
      },
    }));
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches } as never);
    vi.mocked(rerankWithScorer).mockImplementationOnce(async ({ results }) =>
      results.map((r) => ({
        score: 0.9 - Number(r.id.slice(1)) * 0.01,
        result: r,
        details: { semantic: 0, vector: 0, position: 0 },
      })),
    );

    const result = await searchKnowledge("q", vectorize, "key");

    expect(result.results).toHaveLength(5);
    expect(result.results[0].source).toBe("s5.md");
    expect(result.results.map((r) => r.source)).not.toContain("s4.md");
  });

  it("metadata 欠落フィールドは unknown / 空文字で埋め、日付なしは中立の加点になる", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.7, metadata: undefined }],
    } as never);

    vi.mocked(rerankWithScorer).mockImplementationOnce(async ({ results }) => [
      {
        score: 0.5,
        result: results[0],
        details: { semantic: 0, vector: 0, position: 0 },
      },
    ]);

    const result = await searchKnowledge("q", vectorize, "key");
    expect(result.results[0]).toMatchObject({
      content: "",
      source: "unknown",
    });
    expect(result.results[0].score).toBeCloseTo((0.5 + 0.15 * 0.5) / 1.15, 5);
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
});
