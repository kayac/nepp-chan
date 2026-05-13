import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createPollRepository } from "./poll-repository";

const repo = createPollRepository(testApiClient);

const sample = {
  id: "p-1",
  title: "題",
  choices: ["a", "b"],
  followUpPrompt: null,
  status: "draft" as const,
  createdBy: "u",
  createdAt: "x",
  updatedAt: null,
  scheduledAt: null,
  sentAt: null,
  closedAt: null,
};

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("poll-repository", () => {
  it("fetchPolls: status クエリで絞れる", async () => {
    server.use(
      http.get(`${API}/admin/polls`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("sent");
        return HttpResponse.json({
          polls: [],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchPolls({ status: "sent" });
  });

  it("fetchPollById", async () => {
    server.use(
      http.get(`${API}/admin/polls/p-1`, () => HttpResponse.json(sample)),
    );

    const result = await repo.fetchPollById("p-1");
    expect(result?.id).toBe("p-1");
  });

  it("createPoll: POST", async () => {
    server.use(
      http.post(`${API}/admin/polls`, () =>
        HttpResponse.json(sample, { status: 201 }),
      ),
    );

    await repo.createPoll({ title: "x", choices: ["a", "b"] });
  });

  it("updatePoll: PUT", async () => {
    server.use(
      http.put(`${API}/admin/polls/p-1`, () => HttpResponse.json(sample)),
    );

    await repo.updatePoll("p-1", { title: "更新" });
  });

  it("deletePoll: DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/polls/p-1`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await repo.deletePoll("p-1");
  });

  it("sendPollNow: /:id/send", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/send`, () =>
        HttpResponse.json({ message: "sent" }),
      ),
    );

    await repo.sendPollNow("p-1");
  });

  it("closePoll: /:id/close", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/close`, () =>
        HttpResponse.json({ message: "closed" }),
      ),
    );

    await repo.closePoll("p-1");
  });

  it("fetchPollResultsAdmin: 管理画面用結果", async () => {
    server.use(
      http.get(`${API}/admin/polls/p-1/results`, () =>
        HttpResponse.json({
          pollId: "p-1",
          title: "x",
          totalSubmissions: 0,
          choiceResults: [],
        }),
      ),
    );

    const result = await repo.fetchPollResultsAdmin("p-1");
    expect(result?.pollId).toBe("p-1");
  });

  it("fetchPollResults: 公開エンドポイント", async () => {
    server.use(
      http.get(`${API}/polls/p-1`, () =>
        HttpResponse.json({
          pollId: "p-1",
          title: "x",
          totalSubmissions: 5,
          choiceResults: [],
        }),
      ),
    );

    const result = await repo.fetchPollResults("p-1");
    expect(result?.totalSubmissions).toBe(5);
  });

  it("失敗系: fetchPolls 500 は throw", async () => {
    server.use(
      http.get(`${API}/admin/polls`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchPolls()).rejects.toBeDefined();
  });

  it("失敗系: createPoll 400 は throw", async () => {
    server.use(
      http.post(`${API}/admin/polls`, () =>
        HttpResponse.json({ error: { message: "invalid" } }, { status: 400 }),
      ),
    );

    await expect(
      repo.createPoll({ title: "x", choices: ["a", "b"] }),
    ).rejects.toBeDefined();
  });

  describe("残りの失敗系", () => {
    it("fetchPollById: 404 は throw", async () => {
      server.use(
        http.get(`${API}/admin/polls/missing`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 404 }),
        ),
      );
      await expect(repo.fetchPollById("missing")).rejects.toBeDefined();
    });

    it("updatePoll: 5xx は throw", async () => {
      server.use(
        http.put(`${API}/admin/polls/x`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.updatePoll("x", { title: "更" })).rejects.toBeDefined();
    });

    it("deletePoll: 5xx は throw", async () => {
      server.use(
        http.delete(`${API}/admin/polls/x`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.deletePoll("x")).rejects.toBeDefined();
    });

    it("sendPollNow: 5xx は throw", async () => {
      server.use(
        http.post(`${API}/admin/polls/x/send`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.sendPollNow("x")).rejects.toBeDefined();
    });

    it("closePoll: 5xx は throw", async () => {
      server.use(
        http.post(`${API}/admin/polls/x/close`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.closePoll("x")).rejects.toBeDefined();
    });

    it("fetchPollResultsAdmin: 5xx は throw", async () => {
      server.use(
        http.get(`${API}/admin/polls/x/results`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.fetchPollResultsAdmin("x")).rejects.toBeDefined();
    });

    it("fetchPollResults: 5xx は throw", async () => {
      server.use(
        http.get(`${API}/polls/x`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.fetchPollResults("x")).rejects.toBeDefined();
    });
  });
});
