import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";

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

vi.mock("./embedding", () => ({
  deleteKnowledgeBySource: vi.fn(async () => ({ deleted: 0 })),
  processKnowledgeFile: vi.fn(async () => ({ chunks: 3 })),
}));

const { deleteKnowledgeBySource, processKnowledgeFile } = await import(
  "./embedding"
);
const { sha256Hex } = await import("~/lib/crypto");
const { knowledgeSourceRepository } = await import(
  "~/repository/knowledge-source-repository"
);
const { knowledgeCorrectionRepository } = await import(
  "~/repository/knowledge-correction-repository"
);
const { indexKnowledgeSource, removeKnowledgeSource } = await import(
  "./indexing"
);

const d1 = {} as D1Database;
const vectorize = {} as VectorizeIndex;
const deps = { d1, vectorize, apiKey: "key" };

const content = `---
url: 'https://example.com/bus'
---
# バス
本文`;

describe("indexKnowledgeSource", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
    vi.mocked(deleteKnowledgeBySource).mockClear();
    vi.mocked(processKnowledgeFile).mockClear();
  });

  it("未登録の情報源は pending で登録し index しない", async () => {
    const result = await indexKnowledgeSource("bus/index.md", content, deps);

    expect(result).toEqual({ indexed: false, status: "pending", chunks: 0 });
    expect(processKnowledgeFile).not.toHaveBeenCalled();
    expect(deleteKnowledgeBySource).not.toHaveBeenCalled();

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row).toMatchObject({
      approvalStatus: "pending",
      canonicalUrl: "https://example.com/bus",
    });
    expect(row?.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("approved の情報源は index して chunk_count を記録する", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      r2Etag: "etag-1",
    });

    expect(result).toMatchObject({
      indexed: true,
      status: "approved",
      chunks: 3,
    });
    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(
      vectorize,
      "bus/index.md",
    );

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row).toMatchObject({ chunkCount: 3, r2Etag: "etag-1" });
    expect(row?.indexedAt).not.toBeNull();
  });

  it("rejected / disabled は index せずメタデータだけ更新する", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "rejected",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps);

    expect(result).toEqual({ indexed: false, status: "rejected", chunks: 0 });
    expect(processKnowledgeFile).not.toHaveBeenCalled();

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row?.canonicalUrl).toBe("https://example.com/bus");
  });

  it("approveAs 指定で未登録の情報源を approved として登録し index する", async () => {
    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      approveAs: "admin-1",
    });

    expect(result).toMatchObject({ indexed: true, chunks: 3 });

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row).toMatchObject({
      approvalStatus: "approved",
      approvedBy: "admin-1",
    });
    expect(row?.approvedAt).not.toBeNull();
  });

  it("approveAs 指定で pending を approved に昇格して index する", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "pending",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      approveAs: "admin-1",
    });

    expect(result).toMatchObject({ indexed: true, chunks: 3 });

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row).toMatchObject({
      approvalStatus: "approved",
      approvedBy: "admin-1",
    });
  });

  it("approveAs 指定でも rejected / disabled は昇格しない", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "disabled",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      approveAs: "admin-1",
    });

    expect(result).toEqual({ indexed: false, status: "disabled", chunks: 0 });
    expect(processKnowledgeFile).not.toHaveBeenCalled();
  });

  it("skipUnchanged 指定で内容不変の approved は再 index しない", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      sourceHash: await sha256Hex(content),
      chunkCount: 8,
      indexedAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      skipUnchanged: true,
    });

    expect(result).toEqual({ indexed: true, status: "approved", chunks: 8 });
    expect(processKnowledgeFile).not.toHaveBeenCalled();
    expect(deleteKnowledgeBySource).not.toHaveBeenCalled();
  });

  it("skipUnchanged 指定でも内容が変わっていれば再 index する", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      sourceHash: "old-hash",
      indexedAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps, {
      skipUnchanged: true,
    });

    expect(result).toMatchObject({ indexed: true, chunks: 3 });
    expect(processKnowledgeFile).toHaveBeenCalled();
  });

  it("内容不変なら再 index はしてもメタデータは書き換えない", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      sourceHash: await sha256Hex(content),
      canonicalUrl: "https://example.com/manual",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    await indexKnowledgeSource("bus/index.md", content, deps);

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row?.canonicalUrl).toBe("https://example.com/manual");
    expect(row?.chunkCount).toBe(3);
  });

  it("内容が変わったら紐づく訂正を要再確認にする", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      sourceHash: "old-hash",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    await knowledgeCorrectionRepository.insert(d1, {
      id: "cor-1",
      correctsSourcePath: "bus/index.md",
      body: "訂正本文",
      verifiedAt: "2026-09-01",
      approvedBy: "admin-1",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    await indexKnowledgeSource("bus/index.md", content, deps);

    const correction = await knowledgeCorrectionRepository.findById(
      d1,
      "cor-1",
    );
    expect(correction?.needsReviewAt).not.toBeNull();
  });

  it("初回登録では訂正を要再確認にしない", async () => {
    await knowledgeCorrectionRepository.insert(d1, {
      id: "cor-1",
      correctsSourcePath: "bus/index.md",
      body: "訂正本文",
      verifiedAt: "2026-09-01",
      approvedBy: "admin-1",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    await indexKnowledgeSource("bus/index.md", content, deps);

    const correction = await knowledgeCorrectionRepository.findById(
      d1,
      "cor-1",
    );
    expect(correction?.needsReviewAt).toBeNull();
  });

  it("index 済みなのに未承認の情報源はベクトルを削除して整合させる", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "pending",
      chunkCount: 8,
      indexedAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps);

    expect(result).toEqual({ indexed: false, status: "pending", chunks: 0 });
    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(
      vectorize,
      "bus/index.md",
    );
    expect(processKnowledgeFile).not.toHaveBeenCalled();

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row?.chunkCount).toBe(0);
    expect(row?.indexedAt).toBeNull();
  });

  it("index が失敗したら chunk_count を更新せず error を返す", async () => {
    vi.mocked(processKnowledgeFile).mockResolvedValueOnce({
      chunks: 0,
      error: "embedding failed",
    });
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const result = await indexKnowledgeSource("bus/index.md", content, deps);

    expect(result).toMatchObject({ indexed: true, error: "embedding failed" });

    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row?.indexedAt).toBeNull();
  });
});

describe("removeKnowledgeSource", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
    vi.mocked(deleteKnowledgeBySource).mockClear();
  });

  it("ベクトルを削除し manifest の chunk_count を 0 に戻す", async () => {
    await knowledgeSourceRepository.insert(d1, {
      sourcePath: "bus/index.md",
      approvalStatus: "approved",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    await knowledgeSourceRepository.markIndexed(d1, "bus/index.md", 5);

    await removeKnowledgeSource("bus/index.md", { d1, vectorize });

    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(
      vectorize,
      "bus/index.md",
    );
    const row = await knowledgeSourceRepository.findByPath(d1, "bus/index.md");
    expect(row?.chunkCount).toBe(0);
  });

  it("manifest 行が無くてもベクトル削除は行う", async () => {
    await removeKnowledgeSource("unknown.md", { d1, vectorize });
    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(
      vectorize,
      "unknown.md",
    );
  });
});
