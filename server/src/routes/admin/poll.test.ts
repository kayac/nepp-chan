import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("~/services/poll", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/services/poll")>();
  return {
    createPoll: vi.fn(),
    formatPollResponse: actual.formatPollResponse,
    getPoll: vi.fn(),
    updatePoll: vi.fn(),
  };
});

vi.mock("~/services/poll-delivery", () => ({
  sendPoll: vi.fn(),
}));

vi.mock("~/services/poll-results", () => ({
  getPollResults: vi.fn(),
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const pollService = await import("~/services/poll");
const pollDelivery = await import("~/services/poll-delivery");
const pollResults = await import("~/services/poll-results");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { pollAdminRoutes: rawRoutes } = await import("./poll");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "a".repeat(64);
const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const useAuth = (user = adminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(user);
};

const authedJson = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

type PollStatus = "draft" | "scheduled" | "sent" | "closed";

const samplePollDb = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "draft" as PollStatus,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: null,
  closedAt: null,
};

// pollService 経由（formatPollResponse のあと）の API レスポンス用
const samplePoll = {
  ...samplePollDb,
  choices: ["春", "夏", "秋", "冬"],
};

describe("pollAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認可", () => {
    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET /", () => {
    it("正常系: polls / nextCursor / hasMore を返す", async () => {
      useAuth();
      vi.mocked(pollRepository.findAll).mockResolvedValue({
        polls: [{ ...samplePollDb, answerCount: 0 }],
        nextCursor: null,
        hasMore: false,
      });

      const res = await routes.request(
        authedJson("GET", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("answerCount を各 poll に含める", async () => {
      useAuth();
      vi.mocked(pollRepository.findAll).mockResolvedValue({
        polls: [{ ...samplePollDb, answerCount: 3 }],
        nextCursor: null,
        hasMore: false,
      });

      const res = await routes.request(
        authedJson("GET", "/"),
        undefined,
        mockEnv,
      );

      const body = (await res.json()) as {
        polls: { answerCount: number }[];
      };
      expect(body.polls[0]?.answerCount).toBe(3);
    });
  });

  describe("POST /", () => {
    it("正常系: createPoll を呼んで 201", async () => {
      useAuth();
      vi.mocked(pollService.createPoll).mockResolvedValue(samplePoll);

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "テスト投票",
          choices: ["A", "B"],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(pollService.createPoll).toHaveBeenCalledWith(
        mockEnv,
        expect.objectContaining({
          title: "テスト投票",
          choices: ["A", "B"],
          createdBy: "u-1",
        }),
      );
    });

    it("境界値: choices 2 件で 201", async () => {
      useAuth();
      vi.mocked(pollService.createPoll).mockResolvedValue(samplePoll);

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "x",
          choices: ["a", "b"],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
    });

    it("境界値: choices 1 件で 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", { title: "x", choices: ["a"] }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: choices 11 件で 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "x",
          choices: Array.from({ length: 11 }, (_, i) => `c${i}`),
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: title 200 文字ぴったりで 201", async () => {
      useAuth();
      vi.mocked(pollService.createPoll).mockResolvedValue(samplePoll);

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "x".repeat(200),
          choices: ["a", "b"],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
    });

    it("境界値: title 201 文字で 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "x".repeat(201),
          choices: ["a", "b"],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("createPoll が throw すると 500", async () => {
      useAuth();
      vi.mocked(pollService.createPoll).mockRejectedValue(new Error("db"));

      const res = await routes.request(
        authedJson("POST", "/", {
          title: "x",
          choices: ["a", "b"],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id", () => {
    it("正常系", async () => {
      useAuth();
      vi.mocked(pollService.getPoll).mockResolvedValue(samplePoll);

      const res = await routes.request(
        authedJson("GET", "/p-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("存在しなければ 404", async () => {
      useAuth();
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const res = await routes.request(
        authedJson("GET", "/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    it.each(["scheduled", "sent", "closed"])(
      "status=%s は更新拒否（400）",
      async (status) => {
        useAuth();
        vi.mocked(pollRepository.findById).mockResolvedValue({
          ...samplePollDb,
          status: status as PollStatus,
        });

        const res = await routes.request(
          authedJson("PUT", "/p-1", { title: "更新" }),
          undefined,
          mockEnv,
        );

        expect(res.status).toBe(400);
        expect(pollService.updatePoll).not.toHaveBeenCalled();
      },
    );

    it("draft なら更新成功", async () => {
      useAuth();
      vi.mocked(pollRepository.findById).mockResolvedValue(samplePollDb);
      vi.mocked(pollService.updatePoll).mockResolvedValue({
        ...samplePoll,
        title: "更新",
      });

      const res = await routes.request(
        authedJson("PUT", "/p-1", { title: "更新" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("存在しない id は 404", async () => {
      useAuth();
      vi.mocked(pollRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        authedJson("PUT", "/missing", { title: "x" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it.each(["draft", "scheduled"])("status=%s は削除可", async (status) => {
      useAuth();
      vi.mocked(pollRepository.findById).mockResolvedValue({
        ...samplePollDb,
        status: status as PollStatus,
      });
      vi.mocked(pollRepository.delete).mockResolvedValue();

      const res = await routes.request(
        authedJson("DELETE", "/p-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(pollRepository.delete).toHaveBeenCalledWith(mockEnv.DB, "p-1");
    });

    it.each(["sent", "closed"])(
      "status=%s は 400 で削除拒否",
      async (status) => {
        useAuth();
        vi.mocked(pollRepository.findById).mockResolvedValue({
          ...samplePollDb,
          status: status as PollStatus,
        });

        const res = await routes.request(
          authedJson("DELETE", "/p-1"),
          undefined,
          mockEnv,
        );

        expect(res.status).toBe(400);
        expect(pollRepository.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe("POST /:id/send", () => {
    it("正常系: sendPoll 成功で 200", async () => {
      useAuth();
      vi.mocked(pollDelivery.sendPoll).mockResolvedValue({ success: true });

      const res = await routes.request(
        authedJson("POST", "/p-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("error が「見つかりません」を含む場合 404", async () => {
      useAuth();
      vi.mocked(pollDelivery.sendPoll).mockResolvedValue({
        success: false,
        error: "投票が見つかりません",
      });

      const res = await routes.request(
        authedJson("POST", "/p-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });

    it("その他の error は 400", async () => {
      useAuth();
      vi.mocked(pollDelivery.sendPoll).mockResolvedValue({
        success: false,
        error: "既に配信済み",
      });

      const res = await routes.request(
        authedJson("POST", "/p-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:id/results", () => {
    it("正常系", async () => {
      useAuth();
      vi.mocked(pollResults.getPollResults).mockResolvedValue({
        pollId: "p-1",
        title: "テスト",
        totalSubmissions: 0,
        choiceResults: [],
      });

      const res = await routes.request(
        authedJson("GET", "/p-1/results"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("存在しないなら 404", async () => {
      useAuth();
      vi.mocked(pollResults.getPollResults).mockResolvedValue(null);

      const res = await routes.request(
        authedJson("GET", "/missing/results"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /:id/close", () => {
    it("sent 状態のみ締切できる", async () => {
      useAuth();
      vi.mocked(pollRepository.findById).mockResolvedValue({
        ...samplePollDb,
        status: "sent" as PollStatus,
      });
      vi.mocked(pollRepository.update).mockResolvedValue();

      const res = await routes.request(
        authedJson("POST", "/p-1/close"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const arg = vi.mocked(pollRepository.update).mock.calls[0]?.[2];
      expect(arg).toMatchObject({ status: "closed" });
      expect(typeof arg?.closedAt).toBe("string");
    });

    it.each(["draft", "scheduled", "closed"])(
      "status=%s は 400",
      async (status) => {
        useAuth();
        vi.mocked(pollRepository.findById).mockResolvedValue({
          ...samplePollDb,
          status: status as PollStatus,
        });

        const res = await routes.request(
          authedJson("POST", "/p-1/close"),
          undefined,
          mockEnv,
        );

        expect(res.status).toBe(400);
        expect(pollRepository.update).not.toHaveBeenCalled();
      },
    );

    it("冪等性: closed の poll を再度 close しても update を呼ばない", async () => {
      useAuth();
      vi.mocked(pollRepository.findById).mockResolvedValue({
        ...samplePollDb,
        status: "closed" as PollStatus,
      });

      await routes.request(
        authedJson("POST", "/p-1/close"),
        undefined,
        mockEnv,
      );

      expect(pollRepository.update).not.toHaveBeenCalled();
    });
  });
});
