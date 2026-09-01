import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./indexing", () => ({
  removeKnowledgeSource: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { removeKnowledgeSource } = await import("./indexing");
const { deleteFile, getFile, getOriginalFile, listFiles, listUnifiedFiles } =
  await import("./files");

type ObjStub = {
  key: string;
  size: number;
  uploaded: Date;
  etag?: string;
  contentType?: string;
};

const buildBucket = (
  objects: ObjStub[],
  getMap: Record<string, unknown> = {},
) => {
  const matchPrefix = (prefix: string | undefined) =>
    objects
      .filter((o) => (prefix ? o.key.startsWith(prefix) : true))
      .map((o) => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded,
        etag: o.etag ?? "etag",
        httpMetadata: o.contentType
          ? { contentType: o.contentType }
          : undefined,
      }));

  const bucket = {
    list: vi.fn(async (opts?: { prefix?: string; limit?: number }) => ({
      objects: matchPrefix(opts?.prefix),
      truncated: false,
    })),
    get: vi.fn(async (key: string) => getMap[key] ?? null),
    head: vi.fn(async (key: string) => {
      const o = objects.find((obj) => obj.key === key);
      if (!o) return null;
      return {
        httpMetadata: o.contentType
          ? { contentType: o.contentType }
          : undefined,
      };
    }),
    delete: vi.fn(async (_key: string) => {}),
    put: vi.fn(),
  } as unknown as R2Bucket;
  return bucket;
};

beforeEach(() => {
  vi.mocked(removeKnowledgeSource).mockReset();
});

describe("listFiles", () => {
  it("originals/ プレフィックスは除外し、Markdown のみ返す", async () => {
    const bucket = buildBucket([
      {
        key: "originals/doc.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
      {
        key: "doc.md",
        size: 200,
        uploaded: new Date("2030-01-01T00:00:01Z"),
      },
    ]);

    const { files, truncated } = await listFiles(bucket);
    expect(files.map((f) => f.key)).toEqual(["doc.md"]);
    expect(truncated).toBe(false);
  });

  it("Markdown が original より EDIT_THRESHOLD_MS 以上後ろなら edited=true", async () => {
    const bucket = buildBucket([
      {
        key: "originals/x.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
      {
        key: "x.md",
        size: 50,
        uploaded: new Date("2030-01-01T00:01:00Z"), // 60 秒後
      },
    ]);

    const { files } = await listFiles(bucket);
    expect(files[0].edited).toBe(true);
  });

  it("EDIT_THRESHOLD_MS 以内なら edited は undefined", async () => {
    const bucket = buildBucket([
      {
        key: "originals/x.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
      {
        key: "x.md",
        size: 50,
        uploaded: new Date("2030-01-01T00:00:01Z"), // 1 秒後
      },
    ]);

    const { files } = await listFiles(bucket);
    expect(files[0].edited).toBeUndefined();
  });

  it("originals に対応する元ファイルがなければ edited は undefined", async () => {
    const bucket = buildBucket([
      {
        key: "lonely.md",
        size: 50,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);

    const { files } = await listFiles(bucket);
    expect(files[0].edited).toBeUndefined();
  });
});

describe("listUnifiedFiles", () => {
  it("original と markdown を baseName で紐付け", async () => {
    const bucket = buildBucket([
      {
        key: "originals/doc.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
        contentType: "application/pdf",
      },
      {
        key: "doc.md",
        size: 50,
        uploaded: new Date("2030-01-02T00:00:00Z"),
      },
    ]);

    const { files } = await listUnifiedFiles(bucket);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      baseName: "doc",
      hasMarkdown: true,
      original: { contentType: "application/pdf", size: 100 },
      markdown: { size: 50 },
    });
  });

  it("markdown だけのファイルは original undefined", async () => {
    const bucket = buildBucket([
      {
        key: "md-only.md",
        size: 50,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);
    const { files } = await listUnifiedFiles(bucket);
    expect(files[0]).toMatchObject({
      baseName: "md-only",
      hasMarkdown: true,
      original: undefined,
    });
  });

  it("original だけのファイルは hasMarkdown=false", async () => {
    const bucket = buildBucket([
      {
        key: "originals/orphan.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);
    const { files } = await listUnifiedFiles(bucket);
    expect(files[0]).toMatchObject({
      baseName: "orphan",
      hasMarkdown: false,
      markdown: undefined,
    });
  });

  it("contentType 不明なら application/octet-stream にフォールバック", async () => {
    const bucket = buildBucket([
      {
        key: "originals/unknown.bin",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);
    const { files } = await listUnifiedFiles(bucket);
    expect(files[0].original?.contentType).toBe("application/octet-stream");
  });

  it("最終更新日 (markdown 優先) の新しい順でソート", async () => {
    const bucket = buildBucket([
      { key: "a.md", size: 1, uploaded: new Date("2030-01-01T00:00:00Z") },
      { key: "b.md", size: 1, uploaded: new Date("2030-03-01T00:00:00Z") },
      { key: "c.md", size: 1, uploaded: new Date("2030-02-01T00:00:00Z") },
    ]);
    const { files } = await listUnifiedFiles(bucket);
    expect(files.map((f) => f.baseName)).toEqual(["b", "c", "a"]);
  });
});

describe("getFile", () => {
  it("存在すれば content と metadata を返す", async () => {
    const bucket = buildBucket([], {
      "doc.md": {
        text: async () => "# Hello",
        size: 7,
        uploaded: new Date("2030-01-01T00:00:00Z"),
        httpMetadata: { contentType: "text/markdown" },
      },
    });
    const result = await getFile(bucket, "doc.md");
    expect(result).toMatchObject({
      key: "doc.md",
      content: "# Hello",
      contentType: "text/markdown",
      size: 7,
    });
  });

  it("存在しなければ null", async () => {
    const bucket = buildBucket([]);
    expect(await getFile(bucket, "ghost")).toBeNull();
  });

  it("contentType 未指定なら text/markdown にフォールバック", async () => {
    const bucket = buildBucket([], {
      "x.md": {
        text: async () => "x",
        size: 1,
        uploaded: new Date(),
        httpMetadata: undefined,
      },
    });
    const result = await getFile(bucket, "x.md");
    expect(result?.contentType).toBe("text/markdown");
  });
});

describe("getOriginalFile", () => {
  it("originals/<key> から取得", async () => {
    const buf = new ArrayBuffer(8);
    const bucket = buildBucket([], {
      "originals/doc.pdf": {
        arrayBuffer: async () => buf,
        size: 8,
        httpMetadata: { contentType: "application/pdf" },
      },
    });
    const result = await getOriginalFile(bucket, "doc.pdf");
    expect(result).toMatchObject({
      body: buf,
      contentType: "application/pdf",
      size: 8,
    });
  });

  it("存在しなければ null", async () => {
    const bucket = buildBucket([]);
    expect(await getOriginalFile(bucket, "ghost")).toBeNull();
  });

  it("contentType 未指定は application/octet-stream", async () => {
    const bucket = buildBucket([], {
      "originals/x.bin": {
        arrayBuffer: async () => new ArrayBuffer(1),
        size: 1,
        httpMetadata: undefined,
      },
    });
    const result = await getOriginalFile(bucket, "x.bin");
    expect(result?.contentType).toBe("application/octet-stream");
  });
});

const d1 = {} as D1Database;

describe("deleteFile", () => {
  it("Markdown + originals + Vectorize を削除", async () => {
    const bucket = buildBucket([
      {
        key: "originals/doc.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);
    const vectorize = {} as VectorizeIndex;

    await deleteFile(bucket, vectorize, d1, "doc.md");

    expect(bucket.delete).toHaveBeenCalledWith("doc.md");
    expect(bucket.delete).toHaveBeenCalledWith("originals/doc.pdf");
    expect(removeKnowledgeSource).toHaveBeenCalledWith("doc.md", {
      d1,
      vectorize,
    });
  });

  it("key に拡張子無しを渡しても .md を付けて削除", async () => {
    const bucket = buildBucket([]);
    const vectorize = {} as VectorizeIndex;

    await deleteFile(bucket, vectorize, d1, "doc");

    expect(bucket.delete).toHaveBeenCalledWith("doc.md");
  });

  it("基本 baseName と一致しない originals は削除しない", async () => {
    const bucket = buildBucket([
      {
        key: "originals/doc-other.pdf",
        size: 100,
        uploaded: new Date(),
      },
    ]);
    const vectorize = {} as VectorizeIndex;

    await deleteFile(bucket, vectorize, d1, "doc.md");

    // doc.md は削除される
    expect(bucket.delete).toHaveBeenCalledWith("doc.md");
    // originals/doc-other は basename が違うので削除しない
    expect(bucket.delete).not.toHaveBeenCalledWith("originals/doc-other.pdf");
  });
});
