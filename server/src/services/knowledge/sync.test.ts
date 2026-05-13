import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./embedding", () => ({
  deleteKnowledgeBySource: vi.fn(async () => ({ deleted: 0 })),
  processKnowledgeFile: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { deleteKnowledgeBySource, processKnowledgeFile } = await import(
  "./embedding"
);
const { syncAll, syncFile } = await import("./sync");

const buildR2Object = (
  key: string,
  uploadedAt: string | Date = "2030-01-01T00:00:00Z",
): R2Object =>
  ({
    key,
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

beforeEach(() => {
  vi.mocked(deleteKnowledgeBySource)
    .mockReset()
    .mockResolvedValue({ deleted: 0 });
  vi.mocked(processKnowledgeFile).mockReset().mockResolvedValue({ chunks: 2 });
});

describe("syncAll", () => {
  it("md ファイルが無ければ空結果", async () => {
    const bucket = buildBucket([], {});
    const result = await syncAll({ bucket, vectorize, apiKey: "k" });
    expect(result).toEqual({
      results: [],
      totalFiles: 0,
      totalChunks: 0,
      editedCount: 0,
    });
  });

  it("originals/ 配下は処理対象外", async () => {
    const objects = [
      buildR2Object("originals/x.md"),
      buildR2Object("originals/photo.png"),
    ];
    const bucket = buildBucket(objects, {});
    const result = await syncAll({ bucket, vectorize, apiKey: "k" });
    expect(result.totalFiles).toBe(0);
    expect(processKnowledgeFile).not.toHaveBeenCalled();
  });

  it("md ファイルを 1 件処理: 削除 → embedding", async () => {
    const objects = [buildR2Object("doc.md")];
    const bucket = buildBucket(objects, { "doc.md": "# hello" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });

    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(vectorize, "doc.md");
    expect(processKnowledgeFile).toHaveBeenCalledWith(
      "doc.md",
      "# hello",
      vectorize,
      "k",
    );
    expect(result.totalFiles).toBe(1);
    expect(result.totalChunks).toBe(2);
    expect(result.results[0]).toMatchObject({
      file: "doc.md",
      chunks: 2,
      edited: false,
    });
  });

  it("bucket.get が null を返したら error 行を記録して続行", async () => {
    const objects = [buildR2Object("ghost.md"), buildR2Object("real.md")];
    const bucket = buildBucket(objects, {
      "ghost.md": null,
      "real.md": "# r",
    });

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });

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

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });

    expect(result.editedCount).toBe(1);
    expect(result.results[0]?.edited).toBe(true);
  });

  it("md と originals の時間差が閾値以内なら edited=false", async () => {
    const objects = [
      buildR2Object("doc.md", "2030-01-01T00:00:01Z"),
      buildR2Object("originals/doc.png", "2030-01-01T00:00:00Z"),
    ];
    const bucket = buildBucket(objects, { "doc.md": "x" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });

    expect(result.editedCount).toBe(0);
    expect(result.results[0]?.edited).toBe(false);
  });

  it("processKnowledgeFile のエラーを保持する", async () => {
    vi.mocked(processKnowledgeFile).mockResolvedValueOnce({
      chunks: 0,
      error: "embed-failed",
    });
    const objects = [buildR2Object("doc.md")];
    const bucket = buildBucket(objects, { "doc.md": "x" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });

    expect(result.results[0]).toMatchObject({
      file: "doc.md",
      chunks: 0,
      error: "embed-failed",
    });
    expect(result.totalChunks).toBe(0);
  });

  it("複数 md を合計してチャンク数を返す", async () => {
    vi.mocked(processKnowledgeFile)
      .mockResolvedValueOnce({ chunks: 3 })
      .mockResolvedValueOnce({ chunks: 5 });
    const objects = [buildR2Object("a.md"), buildR2Object("b.md")];
    const bucket = buildBucket(objects, { "a.md": "a", "b.md": "b" });

    const result = await syncAll({ bucket, vectorize, apiKey: "k" });
    expect(result.totalFiles).toBe(2);
    expect(result.totalChunks).toBe(8);
  });
});

describe("syncFile", () => {
  it("delete → process を順に呼び結果を返す", async () => {
    vi.mocked(processKnowledgeFile).mockResolvedValueOnce({ chunks: 7 });
    const result = await syncFile("doc.md", "# c", {
      vectorize,
      apiKey: "k",
    });
    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(vectorize, "doc.md");
    expect(processKnowledgeFile).toHaveBeenCalledWith(
      "doc.md",
      "# c",
      vectorize,
      "k",
    );
    expect(result).toEqual({ chunks: 7 });
  });

  it("embedding が失敗したら error を伝播", async () => {
    vi.mocked(processKnowledgeFile).mockResolvedValueOnce({
      chunks: 0,
      error: "no-api-key",
    });
    const result = await syncFile("x.md", "y", { vectorize, apiKey: "k" });
    expect(result.error).toBe("no-api-key");
  });
});
