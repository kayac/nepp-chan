import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/knowledge/indexing", () => ({
  indexKnowledgeSource: vi.fn(),
  removeKnowledgeSource: vi.fn(),
}));

const { indexKnowledgeSource, removeKnowledgeSource } = await import(
  "~/services/knowledge/indexing"
);
const { handleR2Event } = await import("./r2-event-handler");

const r2Bucket = {
  get: vi.fn(),
};

const env = {
  DB: {} as D1Database,
  KNOWLEDGE_BUCKET: r2Bucket,
  VECTORIZE: {} as VectorizeIndex,
  GOOGLE_GENERATIVE_AI_API_KEY: "key",
} as unknown as CloudflareBindings;

const buildMessage = (
  action:
    | "PutObject"
    | "CompleteMultipartUpload"
    | "CopyObject"
    | "DeleteObject"
    | "LifecycleDeletion",
  key: string,
) => ({
  body: {
    account: "a",
    bucket: "b",
    eventTime: "2025-01-01T00:00:00Z",
    action,
    object: { key, size: 0, eTag: "etag" },
  },
  ack: vi.fn(),
  retry: vi.fn(),
  id: "m",
  timestamp: new Date(),
  attempts: 1,
});

const buildBatch = (messages: ReturnType<typeof buildMessage>[]) =>
  ({
    messages,
    queue: "r2-event",
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

describe("handleR2Event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    r2Bucket.get.mockResolvedValue({ text: vi.fn().mockResolvedValue("md") });
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 5,
    });
    vi.mocked(removeKnowledgeSource).mockResolvedValue({ deleted: 3 });
  });

  it(".md 以外は ack して何もしない", async () => {
    const m = buildMessage("PutObject", "image.png");

    await handleR2Event(buildBatch([m]), env);

    expect(m.ack).toHaveBeenCalled();
    expect(indexKnowledgeSource).not.toHaveBeenCalled();
  });

  it.each(["PutObject", "CompleteMultipartUpload", "CopyObject"] as const)(
    "%s は indexKnowledgeSource に eTag 付きで委譲する",
    async (action) => {
      const m = buildMessage(action, "doc.md");

      await handleR2Event(buildBatch([m]), env);

      expect(indexKnowledgeSource).toHaveBeenCalledWith(
        "doc.md",
        "md",
        {
          d1: env.DB,
          vectorize: env.VECTORIZE,
          apiKey: "key",
        },
        { r2Etag: "etag", skipUnchanged: true },
      );
      expect(m.ack).toHaveBeenCalled();
    },
  );

  it("未承認で index が skip されても ack する", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: false,
      status: "pending",
      chunks: 0,
    });
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.ack).toHaveBeenCalled();
    expect(m.retry).not.toHaveBeenCalled();
  });

  it.each(["DeleteObject", "LifecycleDeletion"] as const)(
    "%s は removeKnowledgeSource のみ",
    async (action) => {
      const m = buildMessage(action, "doc.md");

      await handleR2Event(buildBatch([m]), env);

      expect(removeKnowledgeSource).toHaveBeenCalledWith("doc.md", {
        d1: env.DB,
        vectorize: env.VECTORIZE,
      });
      expect(indexKnowledgeSource).not.toHaveBeenCalled();
      expect(m.ack).toHaveBeenCalled();
    },
  );

  it("R2 から取得できないと retry", async () => {
    r2Bucket.get.mockResolvedValue(null);
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
  });

  it("index がエラーを返したら retry", async () => {
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "embed failed",
    });
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
  });

  it("例外が起きたら retry", async () => {
    vi.mocked(indexKnowledgeSource).mockRejectedValue(new Error("boom"));
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
    expect(m.ack).not.toHaveBeenCalled();
  });
});
