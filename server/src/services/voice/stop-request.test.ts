import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { askJevMock } = vi.hoisted(() => ({ askJevMock: vi.fn() }));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { isStopRequest } = await import("./stop-request");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const stopAnswer = (noul: number) => ({
  answers: { stop: { type: "noul", noul } },
});

beforeEach(() => {
  askJevMock.mockReset();
});

describe("isStopRequest", () => {
  it.each([
    [0.85, true],
    [0.5, true],
    [0.49, false],
    [0.03, false],
  ])("jev の確率が %s なら %s", async (noul, expected) => {
    askJevMock.mockResolvedValueOnce(stopAnswer(noul));
    expect(await isStopRequest("もういいや", contextWithKey("k"))).toBe(
      expected,
    );
  });

  it("発話をユーザーの発言として jev に渡す", async () => {
    askJevMock.mockResolvedValueOnce(stopAnswer(0.1));
    await isStopRequest("まだ？", contextWithKey("k"));
    expect(askJevMock.mock.calls[0]?.[0].state).toEqual([
      { from: "user", text: "まだ？" },
    ]);
  });

  it("jev が使えなければ止める側に倒す", async () => {
    expect(await isStopRequest("まだ？", contextWithKey())).toBe(true);
    expect(askJevMock).not.toHaveBeenCalled();
  });

  it("jev が失敗したら止める側に倒す", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    expect(await isStopRequest("まだ？", contextWithKey("k"))).toBe(true);
  });
});
