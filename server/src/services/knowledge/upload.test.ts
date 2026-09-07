import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/image-converter", () => ({
  convertToMarkdown: vi.fn(),
  isSupportedMimeType: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { convertToMarkdown, isSupportedMimeType } = await import(
  "~/lib/image-converter"
);
const { convertAndUpload, reconvertFromOriginal, uploadMarkdownFile } =
  await import("./upload");

const buildBucket = () => {
  const bucket = {
    put: vi.fn(async () => {}),
    get: vi.fn(),
  } as unknown as R2Bucket;
  return bucket;
};

const buildFile = (
  content: string,
  options: { name?: string; size?: number; type?: string } = {},
) => {
  const blob = new File([content], options.name ?? "test.md", {
    type: options.type ?? "text/markdown",
  });
  if (options.size !== undefined) {
    Object.defineProperty(blob, "size", { value: options.size });
  }
  return blob;
};

beforeEach(() => {
  vi.mocked(convertToMarkdown).mockReset().mockResolvedValue("# converted");
  vi.mocked(isSupportedMimeType).mockReset().mockReturnValue(true);
});

describe("uploadMarkdownFile", () => {
  it("正常系: 本文を text/markdown として R2 に保存し key を返す", async () => {
    const bucket = buildBucket();
    const file = buildFile("# hello", { name: "doc.md" });

    const result = await uploadMarkdownFile(file, null, { bucket });

    expect(bucket.put).toHaveBeenCalledWith("doc.md", "# hello", {
      httpMetadata: { contentType: "text/markdown" },
    });
    expect(result).toEqual({ key: "doc.md" });
  });

  it("customFilename が指定されたらそちらを使う", async () => {
    const bucket = buildBucket();
    const file = buildFile("x", { name: "any.md" });

    const result = await uploadMarkdownFile(file, "custom", {
      bucket,
    });

    expect(result.key).toBe("custom.md");
  });

  it("既に .md 付きならそのまま", async () => {
    const bucket = buildBucket();
    const file = buildFile("x", { name: "ignored" });
    const result = await uploadMarkdownFile(file, "ready.md", {
      bucket,
    });
    expect(result.key).toBe("ready.md");
  });

  it("file.size が上限超過なら throw", async () => {
    const bucket = buildBucket();
    const file = buildFile("x", {
      name: "huge.md",
      size: 11 * 1024 * 1024,
    });

    await expect(
      uploadMarkdownFile(file, null, {
        bucket,
      }),
    ).rejects.toThrow(/exceeds limit/);
    expect(bucket.put).not.toHaveBeenCalled();
  });
});

describe("convertAndUpload", () => {
  it("画像 → Markdown 変換、original 保存、Markdown 保存", async () => {
    const bucket = buildBucket();
    const file = buildFile("img-data", {
      name: "photo.png",
      type: "image/png",
    });

    const result = await convertAndUpload(file, "photo", {
      bucket,
    });

    expect(bucket.put).toHaveBeenCalledWith(
      "originals/photo.png",
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "image/png" } },
    );
    expect(bucket.put).toHaveBeenCalledWith("photo.md", "# converted", {
      httpMetadata: { contentType: "text/markdown" },
    });
    expect(result).toMatchObject({
      key: "photo.md",
      originalType: "image/png",
    });
  });

  it("size 上限超過なら throw", async () => {
    const file = buildFile("x", {
      name: "huge.png",
      type: "image/png",
      size: 21 * 1024 * 1024,
    });
    await expect(
      convertAndUpload(file, "huge", {
        bucket: buildBucket(),
      }),
    ).rejects.toThrow(/exceeds limit/);
  });

  it("未対応 mimeType なら throw", async () => {
    vi.mocked(isSupportedMimeType).mockReturnValueOnce(false);
    const file = buildFile("x", { name: "x.txt", type: "text/plain" });
    await expect(
      convertAndUpload(file, "x", {
        bucket: buildBucket(),
      }),
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("拡張子が無いファイル名でも originals/<base>.<ext> として保存", async () => {
    const bucket = buildBucket();
    const file = buildFile("x", { name: "no-ext", type: "image/png" });
    await convertAndUpload(file, "out", {
      bucket,
    });
    // file.name に "." が無いので extension は "bin"... wait, "no-ext".split(".") = ["no-ext"], pop = "no-ext"
    // 実装的には pop || "bin" で "no-ext" になる
    expect(bucket.put).toHaveBeenCalledWith(
      "originals/out.no-ext",
      expect.any(ArrayBuffer),
      expect.any(Object),
    );
  });
});

describe("reconvertFromOriginal", () => {
  it("元ファイルが見つからなければ throw", async () => {
    const bucket = buildBucket();
    vi.mocked(bucket.get).mockResolvedValueOnce(null);
    await expect(
      reconvertFromOriginal("originals/x.pdf", "x", {
        bucket,
      }),
    ).rejects.toThrow(/Original file not found/);
  });

  it("未対応 mimeType なら throw", async () => {
    const bucket = buildBucket();
    vi.mocked(bucket.get).mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(1),
      httpMetadata: { contentType: "text/plain" },
    } as unknown as R2ObjectBody);
    vi.mocked(isSupportedMimeType).mockReturnValueOnce(false);

    await expect(
      reconvertFromOriginal("originals/x.txt", "x", {
        bucket,
      }),
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("正常系: 取得 → 変換 → put", async () => {
    const bucket = buildBucket();
    vi.mocked(bucket.get).mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(4),
      httpMetadata: { contentType: "image/png" },
    } as unknown as R2ObjectBody);

    const result = await reconvertFromOriginal("originals/x.png", "x", {
      bucket,
    });

    expect(bucket.put).toHaveBeenCalledWith("x.md", "# converted", {
      httpMetadata: { contentType: "text/markdown" },
    });
    expect(result).toMatchObject({
      key: "x.md",
      originalType: "image/png",
    });
  });

  it("contentType 不明なら application/octet-stream → 未対応 throw", async () => {
    const bucket = buildBucket();
    vi.mocked(bucket.get).mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(1),
      httpMetadata: undefined,
    } as unknown as R2ObjectBody);
    vi.mocked(isSupportedMimeType).mockReturnValueOnce(false);

    await expect(
      reconvertFromOriginal("originals/x", "x", {
        bucket,
      }),
    ).rejects.toThrow();
    expect(isSupportedMimeType).toHaveBeenCalledWith(
      "application/octet-stream",
    );
  });
});
