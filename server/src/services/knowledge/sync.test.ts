import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./indexing", () => ({
  indexKnowledgeSource: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { indexKnowledgeSource } = await import("./indexing");
const { syncAll, syncFile } = await import("./sync");

const buildR2Object = (
  key: string,
  uploadedAt: string | Date = "2030-01-01T00:00:00Z",
): R2Object =>
  ({
    key,
    etag: `etag-${key}`,
    uploaded: uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt),
  }) as unknown as R2Object;

const buildBucket = (
  objects: R2Object[],
  contents: Record<string, string | null>,
) => {
  return {
    list: vi.fn(async () => ({ objects })),
    get: vi.fn(async (key: string) => {
      const text = contents[key];
      if (text == null) return null;
      return {
        text: async () => text,
      } as unknown as R2ObjectBody;
    }),
  } as unknown as R2Bucket;
};

const vectorize = {} as VectorizeIndex;
const d1 = {} as D1Database;

beforeEach(() => {
  vi.mocked(indexKnowledgeSource)
    .mockReset()
    .mockResolvedValue({ indexed: true, status: "approved", chunks: 2 });
});

describe("syncAll", () => {
  it("md ファイルが無ければ空結果", async () => {
    const bucket = buildBucket([], {});
    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });
    expect(result).toEqual({
      results: [],
      totalFiles: 0,
      totalChunks: 0,
      editedCount: 0,
      skippedCount: 0,
    });
  });

  it("originals/ 配下は処理対象外", async () => {
    const objects = [
      buildR2Object("originals/x.md"),
      buildR2Object("originals/photo.png"),
    ];
    const bucket = buildBucket(objects, {});
    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });
    expect(result.totalFiles).toBe(0);
    expect(indexKnowledgeSource).not.toHaveBeenCalled();
  });

  it("md ファイルを indexKnowledgeSource へ渡す", async () => {
    const objects = [buildR2Object("doc.md")];
    const bucket = buildBucket(objects, { "doc.md": "# hello" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(indexKnowledgeSource).toHaveBeenCalledWith(
      "doc.md",
      "# hello",
      { d1, vectorize, apiKey: "k" },
      { r2Etag: "etag-doc.md" },
    );
    expect(result.totalFiles).toBe(1);
    expect(result.totalChunks).toBe(2);
    expect(result.results[0]).toMatchObject({
      file: "doc.md",
      chunks: 2,
      edited: false,
    });
  });

  it("未承認で skip された情報源を skippedCount に数える", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValueOnce({
      indexed: false,
      status: "pending",
      chunks: 0,
    });
    const objects = [buildR2Object("doc.md")];
    const bucket = buildBucket(objects, { "doc.md": "x" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(result.skippedCount).toBe(1);
    expect(result.results[0]).toMatchObject({ file: "doc.md", skipped: true });
  });

  it("bucket.get が null を返したら error 行を記録して続行", async () => {
    const objects = [buildR2Object("ghost.md"), buildR2Object("real.md")];
    const bucket = buildBucket(objects, {
      "ghost.md": null,
      "real.md": "# r",
    });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(result.totalFiles).toBe(2);
    expect(result.results.find((r) => r.file === "ghost.md")).toMatchObject({
      chunks: 0,
      error: "File not found",
    });
    expect(result.results.find((r) => r.file === "real.md")?.chunks).toBe(2);
  });

  it("originals より md が新しい場合 edited=true", async () => {
    const objects = [
      buildR2Object("doc.md", "2030-01-01T00:01:00Z"),
      buildR2Object("originals/doc.png", "2030-01-01T00:00:00Z"),
    ];
    const bucket = buildBucket(objects, { "doc.md": "edited content" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(result.editedCount).toBe(1);
    expect(result.results[0]?.edited).toBe(true);
  });

  it("md と originals の時間差が閾値以内なら edited=false", async () => {
    const objects = [
      buildR2Object("doc.md", "2030-01-01T00:00:01Z"),
      buildR2Object("originals/doc.png", "2030-01-01T00:00:00Z"),
    ];
    const bucket = buildBucket(objects, { "doc.md": "x" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(result.editedCount).toBe(0);
    expect(result.results[0]?.edited).toBe(false);
  });

  it("index のエラーを保持する", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValueOnce({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "embed-failed",
    });
    const objects = [buildR2Object("doc.md")];
    const bucket = buildBucket(objects, { "doc.md": "x" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });

    expect(result.results[0]).toMatchObject({
      file: "doc.md",
      chunks: 0,
      error: "embed-failed",
    });
    expect(result.totalChunks).toBe(0);
  });

  it("複数 md を合計してチャンク数を返す", async () => {
    vi.mocked(indexKnowledgeSource)
      .mockResolvedValueOnce({ indexed: true, status: "approved", chunks: 3 })
      .mockResolvedValueOnce({ indexed: true, status: "approved", chunks: 5 });
    const objects = [buildR2Object("a.md"), buildR2Object("b.md")];
    const bucket = buildBucket(objects, { "a.md": "a", "b.md": "b" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k", d1 });
    expect(result.totalFiles).toBe(2);
    expect(result.totalChunks).toBe(8);
  });
});

describe("syncFile", () => {
  it("approveAs 付きで indexKnowledgeSource に委譲する", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValueOnce({
      indexed: true,
      status: "approved",
      chunks: 7,
    });
    const result = await syncFile("doc.md", "# c", {
      vectorize,
      apiKey: "k",
      d1,
      approveAs: "admin-1",
    });
    expect(indexKnowledgeSource).toHaveBeenCalledWith(
      "doc.md",
      "# c",
      { d1, vectorize, apiKey: "k" },
      { approveAs: "admin-1" },
    );
    expect(result).toMatchObject({ chunks: 7, indexed: true });
  });

  it("index の error を伝播する", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValueOnce({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "no-api-key",
    });
    const result = await syncFile("x.md", "y", {
      vectorize,
      apiKey: "k",
      d1,
      approveAs: "admin-1",
    });
    expect(result.error).toBe("no-api-key");
  });
});
