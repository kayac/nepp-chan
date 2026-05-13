import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    findRecentSent: vi.fn(),
  },
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { buildBroadcastMemory } = await import("./broadcast-memory");

const fakeD1 = {} as D1Database;

const buildDetail = (overrides: {
  id: string;
  title: string;
  body: string;
  parts?: string | null;
  sentAt?: string | null;
  createdAt?: string;
}) => ({
  id: overrides.id,
  title: overrides.title,
  body: overrides.body,
  parts: overrides.parts ?? null,
  status: "sent",
  scheduledAt: null,
  sentAt: overrides.sentAt ?? null,
  errorMessage: null,
  createdBy: "admin",
  createdAt: overrides.createdAt ?? "2030-01-01T00:00:00Z",
  updatedAt: null,
});

beforeEach(() => {
  vi.mocked(broadcastRepository.findRecentSent).mockReset();
});

describe("buildBroadcastMemory", () => {
  it("details / summaries が空なら空文字を返す", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [],
      summaries: [],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toBe("");
  });

  it("details のみがあれば最近の配信セクションを出す", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [
        buildDetail({
          id: "b-1",
          title: "おしらせ",
          body: "雪まつり開催",
          sentAt: "2030-01-10T10:00:00Z",
          createdAt: "2030-01-10T09:00:00Z",
        }),
      ],
      summaries: [],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toContain("### 最近の配信（詳細）");
    expect(result).toContain("[2030-01-10] おしらせ");
    expect(result).toContain("内容: 雪まつり開催");
    expect(result).not.toContain("### 過去の配信一覧");
  });

  it("sentAt が無いときは createdAt で日付を表す", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [
        buildDetail({
          id: "b-1",
          title: "T",
          body: "B",
          createdAt: "2030-02-15T09:00:00Z",
        }),
      ],
      summaries: [],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toContain("[2030-02-15]");
  });

  it("parts に image+description があれば添付画像の内容を出す", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [
        buildDetail({
          id: "b-1",
          title: "T",
          body: "B",
          parts: JSON.stringify([
            { type: "text", text: "hello" },
            { type: "image", imageR2Key: "k1", imageDescription: "雪景色" },
            { type: "image", imageR2Key: "k2" },
          ]),
          sentAt: "2030-01-10T10:00:00Z",
          createdAt: "2030-01-10T09:00:00Z",
        }),
      ],
      summaries: [],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toContain("添付画像の内容: 雪景色");
    // imageDescription を持たない画像パートは出さない
    expect(result.match(/添付画像の内容:/g)).toHaveLength(1);
  });

  it("parts が不正 JSON でも throw せず画像説明セクションを出さない", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [
        buildDetail({
          id: "b-1",
          title: "T",
          body: "B",
          parts: "{not-json",
          sentAt: "2030-01-10T10:00:00Z",
          createdAt: "2030-01-10T09:00:00Z",
        }),
      ],
      summaries: [],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).not.toContain("添付画像の内容");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("summaries のみがあれば過去の配信一覧セクションを出す", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [],
      summaries: [
        {
          id: "b-1",
          title: "古いおしらせ",
          sentAt: "2030-01-05T10:00:00Z",
        },
      ],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toContain("### 過去の配信一覧");
    expect(result).toContain("[2030-01-05] 古いおしらせ (id: b-1)");
    expect(result).not.toContain("### 最近の配信（詳細）");
  });

  it("summaries の sentAt が null なら空の日付を含む", async () => {
    vi.mocked(broadcastRepository.findRecentSent).mockResolvedValueOnce({
      details: [],
      summaries: [{ id: "b-1", title: "T", sentAt: null as unknown as string }],
    });

    const result = await buildBroadcastMemory(fakeD1);

    expect(result).toContain("[] T (id: b-1)");
  });
});
