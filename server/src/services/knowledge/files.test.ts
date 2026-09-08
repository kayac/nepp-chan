import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { deleteFile, deleteLegacyFiles, getFile, listFiles } = await import(
  "./files"
);

type ObjStub = {
  key: string;
  size: number;
  uploaded: Date;
};

type ListPage = { objects: ObjStub[]; cursor?: string };

const toR2Object = (o: ObjStub) => ({
  key: o.key,
  size: o.size,
  uploaded: o.uploaded,
  etag: "etag",
});

const buildBucket = (
  objects: ObjStub[],
  getMap: Record<string, unknown> = {},
) => {
  const matchPrefix = (prefix: string | undefined) =>
    objects
      .filter((o) => (prefix ? o.key.startsWith(prefix) : true))
      .map(toR2Object);

  return {
    list: vi.fn(async (opts?: { prefix?: string; limit?: number }) => ({
      objects: matchPrefix(opts?.prefix),
      truncated: false,
    })),
    get: vi.fn(async (key: string) => getMap[key] ?? null),
    delete: vi.fn(async (_keys: string | string[]) => {}),
    put: vi.fn(),
  } as unknown as R2Bucket;
};

const buildPagedBucket = (pages: ListPage[]) => {
  const byCursor = new Map(
    pages.map((page, i) => [i === 0 ? undefined : `c${i}`, { page, i }]),
  );
  return {
    list: vi.fn(async (opts?: { cursor?: string }) => {
      const found = byCursor.get(opts?.cursor);
      if (!found) throw new Error(`unknown cursor: ${opts?.cursor}`);
      const isLast = found.i === pages.length - 1;
      return {
        objects: found.page.objects.map(toR2Object),
        truncated: !isLast,
        ...(isLast ? {} : { cursor: `c${found.i + 1}` }),
      };
    }),
    delete: vi.fn(async (_keys: string | string[]) => {}),
  } as unknown as R2Bucket;
};

const obj = (key: string, uploaded = "2030-01-01T00:00:00Z") => ({
  key,
  size: 1,
  uploaded: new Date(uploaded),
});

describe("listFiles", () => {
  it("prefix・limit・cursor を R2 にそのまま渡し、key/size/lastModified に写す", async () => {
    const bucket = buildBucket([
      {
        key: "official/a.md",
        size: 200,
        uploaded: new Date("2030-01-01T00:00:01Z"),
      },
      obj("curated/b.md"),
    ]);

    const result = await listFiles(bucket, {
      prefix: "official/",
      limit: 30,
      cursor: "abc",
    });

    expect(bucket.list).toHaveBeenCalledWith({
      prefix: "official/",
      limit: 30,
      cursor: "abc",
    });
    expect(result).toEqual({
      files: [
        {
          key: "official/a.md",
          size: 200,
          lastModified: "2030-01-01T00:00:01.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("truncated なら nextCursor と hasMore を返す", async () => {
    const bucket = buildPagedBucket([
      { objects: [obj("official/a.md")] },
      { objects: [obj("official/b.md")] },
    ]);

    const result = await listFiles(bucket, { limit: 1 });

    expect(result.nextCursor).toBe("c1");
    expect(result.hasMore).toBe(true);
  });
});

describe("deleteLegacyFiles", () => {
  it("curated/ official/ 以外をページごとにまとめて削除し、件数を返す", async () => {
    const bucket = buildPagedBucket([
      {
        objects: [
          obj("welcome.md"),
          obj("curated/keep.md"),
          obj("originals/chirashi.pdf"),
        ],
      },
      {
        objects: [
          obj("villotoinep/index.md"),
          obj("official/keep.md"),
          obj("official.md"),
        ],
      },
    ]);

    const result = await deleteLegacyFiles(bucket);

    expect(bucket.delete).toHaveBeenCalledTimes(2);
    expect(bucket.delete).toHaveBeenNthCalledWith(1, [
      "welcome.md",
      "originals/chirashi.pdf",
    ]);
    expect(bucket.delete).toHaveBeenNthCalledWith(2, [
      "villotoinep/index.md",
      "official.md",
    ]);
    expect(result).toEqual({ deleted: 4 });
  });

  it("消す対象が無いページでは delete を呼ばない", async () => {
    const bucket = buildPagedBucket([
      { objects: [obj("curated/a.md"), obj("official/b.md")] },
    ]);

    const result = await deleteLegacyFiles(bucket);

    expect(bucket.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0 });
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

describe("deleteFile", () => {
  it("Markdown と originals を削除する", async () => {
    const bucket = buildBucket([
      {
        key: "originals/doc.pdf",
        size: 100,
        uploaded: new Date("2030-01-01T00:00:00Z"),
      },
    ]);
    await deleteFile(bucket, "doc.md");

    expect(bucket.delete).toHaveBeenCalledWith("doc.md");
    expect(bucket.delete).toHaveBeenCalledWith("originals/doc.pdf");
  });

  it("key に拡張子無しを渡しても .md を付けて削除", async () => {
    const bucket = buildBucket([]);
    await deleteFile(bucket, "doc");

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
    await deleteFile(bucket, "doc.md");

    expect(bucket.delete).toHaveBeenCalledWith("doc.md");
    expect(bucket.delete).not.toHaveBeenCalledWith("originals/doc-other.pdf");
  });
});
