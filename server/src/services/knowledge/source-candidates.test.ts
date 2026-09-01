import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { sourceCandidates } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { knowledgeSourceRepository } = await import(
  "~/repository/knowledge-source-repository"
);
const { captureSourceCandidates, extractUrls } = await import(
  "./source-candidates"
);

const d1 = {} as D1Database;

const buildContext = (values: Record<string, unknown> = {}) => {
  const context = new RequestContext();
  context.set("db", d1);
  for (const [key, value] of Object.entries(values)) {
    context.set(key, value);
  }
  return context;
};

const seedSource = (sourcePath: string, canonicalUrl: string) =>
  knowledgeSourceRepository.insert(d1, {
    sourcePath,
    canonicalUrl,
    approvalStatus: "approved",
    createdAt: "2026-09-01T00:00:00.000Z",
  });

describe("extractUrls", () => {
  it("テキストから URL を抽出し正規化・重複排除する", () => {
    const text = `
情報源:
- https://example.com/a/ と https://example.com/a#top は同じ
- (https://example.com/b)
- https://example.com/c。
`;
    expect(extractUrls(text)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ]);
  });

  it("URL が無ければ空配列", () => {
    expect(extractUrls("URLなし")).toEqual([]);
  });
});

describe("captureSourceCandidates", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("既知 host の未収集 URL を pending 候補として登録する", async () => {
    await seedSource("bus/index.md", "https://vill.example.jp/bus");

    await captureSourceCandidates(
      buildContext({ answerRunId: "ar-1" }),
      "詳細は https://vill.example.jp/garbage を参照",
    );

    const rows = await (testDbHolder.db as TestDb)
      .select()
      .from(sourceCandidates)
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      url: "https://vill.example.jp/garbage",
      status: "pending",
      occurrenceCount: 1,
      relatedAnswerRunId: "ar-1",
    });
  });

  it("収集済み URL と未知 host の URL は候補にしない", async () => {
    await seedSource("bus/index.md", "https://vill.example.jp/bus");

    await captureSourceCandidates(
      buildContext(),
      "https://vill.example.jp/bus/ と https://other.example.com/page",
    );

    const rows = await (testDbHolder.db as TestDb)
      .select()
      .from(sourceCandidates)
      .all();
    expect(rows).toHaveLength(0);
  });

  it("既存候補は出現回数を増やし answerRunId を更新する", async () => {
    await seedSource("bus/index.md", "https://vill.example.jp/bus");

    await captureSourceCandidates(
      buildContext({ answerRunId: "ar-1" }),
      "https://vill.example.jp/garbage",
    );
    await captureSourceCandidates(
      buildContext({ answerRunId: "ar-2" }),
      "https://vill.example.jp/garbage",
    );

    const rows = await (testDbHolder.db as TestDb)
      .select()
      .from(sourceCandidates)
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurrenceCount: 2,
      relatedAnswerRunId: "ar-2",
    });
  });

  it("db が無ければ何もしない", async () => {
    await captureSourceCandidates(
      new RequestContext(),
      "https://vill.example.jp/garbage",
    );

    const rows = await (testDbHolder.db as TestDb)
      .select()
      .from(sourceCandidates)
      .all();
    expect(rows).toHaveLength(0);
  });

  it("取得に失敗しても throw しない", async () => {
    const context = buildContext();
    testDbHolder.db = null;

    await expect(
      captureSourceCandidates(context, "https://vill.example.jp/garbage"),
    ).resolves.toBeUndefined();
  });
});
