import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("~/services/poll-results", () => ({
  getPollResults: vi.fn(),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { getPollResults } = await import("~/services/poll-results");
const { pollRoutes: rawRoutes } = await import("./poll");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const samplePoll = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "sent" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: "2025-01-02T00:00:00Z",
  closedAt: null,
};

const sampleResults = {
  pollId: "p-1",
  title: "好きな季節",
  totalSubmissions: 10,
  choiceResults: [
    { choice: "春", count: 3, percentage: 30 },
    { choice: "夏", count: 2, percentage: 20 },
    { choice: "秋", count: 4, percentage: 40 },
    { choice: "冬", count: 1, percentage: 10 },
  ],
};

describe("pollRoutes (公開): GET /:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: sent 状態の poll の results を認証不要で返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(samplePoll);
    vi.mocked(getPollResults).mockResolvedValue(sampleResults);

    const res = await routes.request(
      new Request("http://localhost/p-1", { method: "GET" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof sampleResults;
    expect(body.totalSubmissions).toBe(10);
    expect(body.choiceResults).toHaveLength(4);
  });

  it("closed 状態の poll も結果を返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...samplePoll,
      status: "closed",
      closedAt: "2025-01-10T00:00:00Z",
    });
    vi.mocked(getPollResults).mockResolvedValue(sampleResults);

    const res = await routes.request(
      new Request("http://localhost/p-1", { method: "GET" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
  });

  // 状態遷移: draft / scheduled は公開対象外（404 として隠す）
  it.each(["draft", "scheduled"] as const)(
    "status=%s は 404 を返す（公開対象外）",
    async (status) => {
      vi.mocked(pollRepository.findById).mockResolvedValue({
        ...samplePoll,
        status,
      });

      const res = await routes.request(
        new Request("http://localhost/p-1", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(getPollResults).not.toHaveBeenCalled();
    },
  );

  it("存在しない poll は 404", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);

    const res = await routes.request(
      new Request("http://localhost/missing", { method: "GET" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("getPollResults が null を返す場合は 404", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(samplePoll);
    vi.mocked(getPollResults).mockResolvedValue(null);

    const res = await routes.request(
      new Request("http://localhost/p-1", { method: "GET" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
  });
});
