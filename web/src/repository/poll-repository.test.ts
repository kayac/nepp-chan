import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import {
  closePoll,
  createPoll,
  deletePoll,
  fetchPollById,
  fetchPollResults,
  fetchPollResultsAdmin,
  fetchPolls,
  sendPollNow,
  updatePoll,
} from "./poll-repository";

const API = "http://localhost:8787";

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
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
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

    await fetchPolls({ status: "sent" });
  });

  it("fetchPollById", async () => {
    server.use(
      http.get(`${API}/admin/polls/p-1`, () => HttpResponse.json(sample)),
    );

    const result = await fetchPollById("p-1");
    expect(result?.id).toBe("p-1");
  });

  it("createPoll: POST", async () => {
    server.use(
      http.post(`${API}/admin/polls`, () =>
        HttpResponse.json(sample, { status: 201 }),
      ),
    );

    await createPoll({ title: "x", choices: ["a", "b"] });
  });

  it("updatePoll: PUT", async () => {
    server.use(
      http.put(`${API}/admin/polls/p-1`, () => HttpResponse.json(sample)),
    );

    await updatePoll("p-1", { title: "更新" });
  });

  it("deletePoll: DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/polls/p-1`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await deletePoll("p-1");
  });

  it("sendPollNow: /:id/send", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/send`, () =>
        HttpResponse.json({ message: "sent" }),
      ),
    );

    await sendPollNow("p-1");
  });

  it("closePoll: /:id/close", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/close`, () =>
        HttpResponse.json({ message: "closed" }),
      ),
    );

    await closePoll("p-1");
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

    const result = await fetchPollResultsAdmin("p-1");
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

    const result = await fetchPollResults("p-1");
    expect(result?.totalSubmissions).toBe(5);
  });
});
