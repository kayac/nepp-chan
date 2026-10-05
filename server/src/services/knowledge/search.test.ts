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

vi.mock("./rerank-scorer", () => ({
  scoreRelevance: vi.fn(),
}));

vi.mock("ai", () => ({
  embed: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { embed } = await import("ai");
const { scoreRelevance } = await import("./rerank-scorer");
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
  vi.mocked(scoreRelevance).mockReset();
  vi.mocked(logger.error).mockReset();
});

describe("searchKnowledge", () => {
  it("matches が無ければ空配列を返す", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches: [] } as never);

    const result = await searchKnowledge("foo", vectorize, "key");
    expect(result).toEqual({ results: [] });
    expect(scoreRelevance).not.toHaveBeenCalled();
  });

  it("候補の本文を関連度の採点に渡し、metadata を結果に写す", async () => {
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

    vi.mocked(scoreRelevance).mockResolvedValueOnce([0.95]);

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
    expect(scoreRelevance).toHaveBeenCalledWith("クエリ", ["本文1"], undefined);
  });

  it("vector 候補は新しさ込みで上位 15 件に絞って採点する", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    const oldMatches = Array.from({ length: 15 }, (_, i) => ({
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
    vi.mocked(scoreRelevance).mockImplementationOnce(async (_q, texts) =>
      texts.map(() => 0.5),
    );

    await searchKnowledge("q", vectorize, "key");

    const texts = vi.mocked(scoreRelevance).mock.calls[0]?.[1] ?? [];
    expect(texts).toHaveLength(15);
    expect(texts).toContain("新しい");
    expect(texts).not.toContain("古い14");
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
    vi.mocked(scoreRelevance).mockImplementationOnce(async (_q, texts) =>
      texts.map((text) => 0.9 - Number(text.slice(1)) * 0.01),
    );

    const result = await searchKnowledge("q", vectorize, "key");

    expect(result.results).toHaveLength(5);
    expect(result.results[0].source).toBe("s5.md");
    expect(result.results.map((r) => r.source)).not.toContain("s4.md");
  });

  it("metadata 欠落フィールドは unknown / 空文字で埋める", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [{ id: "v1", score: 0.7, metadata: undefined }],
    } as never);

    vi.mocked(scoreRelevance).mockResolvedValueOnce([0.5]);

    const result = await searchKnowledge("q", vectorize, "key");
    expect(result.results[0]).toMatchObject({
      content: "",
      source: "unknown",
    });
  });

  it("関連度とベクトルの近さを半々で混ぜて並べる", async () => {
    vi.mocked(embed).mockResolvedValueOnce({ embedding: [0.1] } as never);
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({
      matches: [
        { id: "near", score: 0.9, metadata: { content: "近いだけ" } },
        { id: "answer", score: 0.6, metadata: { content: "答え" } },
      ],
    } as never);
    vi.mocked(scoreRelevance).mockResolvedValueOnce([0.1, 0.9]);

    const result = await searchKnowledge("q", vectorize, "key");

    expect(result.results.map((r) => r.content)).toEqual(["答え", "近いだけ"]);
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
