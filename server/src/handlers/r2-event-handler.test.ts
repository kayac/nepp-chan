import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/knowledge/embedding", () => ({
  deleteKnowledgeBySource: vi.fn(),
  processKnowledgeFile: vi.fn(),
}));

const { deleteKnowledgeBySource, processKnowledgeFile } = await import(
  "~/services/knowledge/embedding"
);
const { handleR2Event } = await import("./r2-event-handler");

const r2Bucket = {
  get: vi.fn(),
};

const env = {
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
    vi.mocked(deleteKnowledgeBySource).mockResolvedValue({ deleted: 3 });
    vi.mocked(processKnowledgeFile).mockResolvedValue({ chunks: 5 });
  });

  it(".md 以外は ack して何もしない", async () => {
    const m = buildMessage("PutObject", "image.png");

    await handleR2Event(buildBatch([m]), env);

    expect(m.ack).toHaveBeenCalled();
    expect(processKnowledgeFile).not.toHaveBeenCalled();
  });

  it.each([
    "PutObject",
    "CompleteMultipartUpload",
    "CopyObject",
  ] as const)("%s は delete + processKnowledgeFile を順に呼ぶ", async (action) => {
    const m = buildMessage(action, "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(deleteKnowledgeBySource).toHaveBeenCalledWith(
      env.VECTORIZE,
      "doc.md",
    );
    expect(processKnowledgeFile).toHaveBeenCalled();
    expect(m.ack).toHaveBeenCalled();
  });

  it.each([
    "DeleteObject",
    "LifecycleDeletion",
  ] as const)("%s は deleteKnowledgeBySource のみ", async (action) => {
    const m = buildMessage(action, "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(deleteKnowledgeBySource).toHaveBeenCalled();
    expect(processKnowledgeFile).not.toHaveBeenCalled();
    expect(m.ack).toHaveBeenCalled();
  });

  it("R2 から取得できないと retry", async () => {
    r2Bucket.get.mockResolvedValue(null);
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
  });

  it("processKnowledgeFile がエラーを返したら retry", async () => {
    vi.mocked(processKnowledgeFile).mockResolvedValue({
      error: "embed failed",
      chunks: 0,
    });
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
  });

  it("例外が起きたら retry", async () => {
    vi.mocked(processKnowledgeFile).mockRejectedValue(new Error("boom"));
    const m = buildMessage("PutObject", "doc.md");

    await handleR2Event(buildBatch([m]), env);

    expect(m.retry).toHaveBeenCalled();
    expect(m.ack).not.toHaveBeenCalled();
  });
});
