import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeResult } from "./search";

vi.mock("~/repository/knowledge-correction-repository", () => ({
  knowledgeCorrectionRepository: {
    listPublishedByCorrects: vi.fn(),
  },
}));

vi.mock("./indexing", () => ({
  indexKnowledgeSource: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { knowledgeCorrectionRepository } = await import(
  "~/repository/knowledge-correction-repository"
);
const { indexKnowledgeSource } = await import("./indexing");
const {
  applyCorrections,
  buildCorrectionMarkdown,
  correctionSourcePath,
  publishCorrection,
} = await import("./corrections");

const d1 = {} as D1Database;

const correction = {
  id: "cor-1",
  correctsSourcePath: "bus/index.md",
  body: "土曜は運休です",
  status: "published",
  verifiedAt: "2026-09-01",
  approvedBy: "admin-1",
  relatedFeedbackId: null,
  answerRunId: null,
  needsReviewAt: null,
  needsReviewReason: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
};

const hit = (source: string): KnowledgeResult => ({
  content: "本文",
  score: 0.9,
  source,
});

beforeEach(() => {
  vi.mocked(knowledgeCorrectionRepository.listPublishedByCorrects).mockReset();
  vi.mocked(indexKnowledgeSource).mockReset();
});

describe("buildCorrectionMarkdown", () => {
  it("curated 契約の frontmatter と corrects を持つ Markdown を生成する", () => {
    const markdown = buildCorrectionMarkdown(correction, {
      canonicalUrl: "https://example.com/bus",
    });

    expect(markdown).toContain("source_type: curated");
    expect(markdown).toContain("source_authority: 2");
    expect(markdown).toContain("verified_at: '2026-09-01'");
    expect(markdown).toContain("corrects: bus/index.md");
    expect(markdown).toContain("url: 'https://example.com/bus'");
    expect(markdown).toContain("土曜は運休です");
  });

  it("canonicalUrl が無ければ url を含めない", () => {
    expect(buildCorrectionMarkdown(correction)).not.toContain("url:");
  });
});

describe("publishCorrection", () => {
  it("R2 へ保存し approveAs 付きで index する", async () => {
    const bucket = { put: vi.fn() } as unknown as R2Bucket;
    const vectorize = {} as VectorizeIndex;
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 1,
    });

    await publishCorrection(
      { d1, bucket, vectorize, apiKey: "key" },
      correction,
    );

    expect(bucket.put).toHaveBeenCalledWith(
      "curated/corrections/cor-1.md",
      expect.stringContaining("土曜は運休です"),
      { httpMetadata: { contentType: "text/markdown" } },
    );
    expect(indexKnowledgeSource).toHaveBeenCalledWith(
      "curated/corrections/cor-1.md",
      expect.any(String),
      { d1, vectorize, apiKey: "key" },
      { approveAs: "admin-1" },
    );
  });
});

describe("applyCorrections", () => {
  it("hit した source への published 訂正を結果に追加する", async () => {
    vi.mocked(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).mockResolvedValue([correction]);

    const results = await applyCorrections(d1, [hit("bus/index.md")]);

    expect(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).toHaveBeenCalledWith(d1, ["bus/index.md"]);
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({
      source: "curated/corrections/cor-1.md",
      title: "村による訂正",
      date: "2026-09-01",
      dateType: "verified",
    });
    expect(results[1].content).toContain("土曜は運休です");
  });

  it("訂正自身が既に hit していれば重複追加しない", async () => {
    vi.mocked(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).mockResolvedValue([correction]);

    const results = await applyCorrections(d1, [
      hit("bus/index.md"),
      hit(correctionSourcePath("cor-1")),
    ]);

    expect(results).toHaveLength(2);
  });

  it("訂正 source は照合対象に含めない", async () => {
    vi.mocked(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).mockResolvedValue([]);

    await applyCorrections(d1, [hit(correctionSourcePath("cor-1"))]);

    expect(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).toHaveBeenCalledWith(d1, []);
  });

  it("該当訂正が無ければ結果をそのまま返す", async () => {
    vi.mocked(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).mockResolvedValue([]);

    const input = [hit("bus/index.md")];
    expect(await applyCorrections(d1, input)).toBe(input);
  });

  it("取得に失敗しても throw せず元の結果を返す", async () => {
    vi.mocked(
      knowledgeCorrectionRepository.listPublishedByCorrects,
    ).mockRejectedValue(new Error("boom"));

    const input = [hit("bus/index.md")];
    expect(await applyCorrections(d1, input)).toBe(input);
  });
});
