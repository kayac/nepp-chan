import { beforeEach, describe, expect, it, vi } from "vitest";
import { askJev, JevHttpError } from "./jev";

const fetchSpy = vi.spyOn(globalThis, "fetch");

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const question = {
  type: "choice" as const,
  instructions: "Classify",
  criteria: { a: "A", b: "B" },
};

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("askJev", () => {
  it("api.typesafe.ai に Bearer 認証・jev-latest・state・questions を POST する", async () => {
    fetchSpy.mockResolvedValueOnce(
      ok({
        answers: {
          q: { type: "choice", choice: "a", probabilities: { a: 0.9, b: 0.1 } },
        },
      }),
    );
    await askJev({
      apiKey: "secret",
      state: [{ from: "user", text: "hi" }],
      questions: { q: question },
    });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer secret",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "jev-latest",
      state: [{ from: "user", text: "hi" }],
      questions: { q: question },
    });
  });

  it("choice / noul / score の answers と model・usage を返す", async () => {
    fetchSpy.mockResolvedValueOnce(
      ok({
        model: "jev-1.13.0",
        answers: {
          c: {
            type: "choice",
            choice: "a",
            probabilities: { a: 0.7, b: 0.3 },
            confidence: 0.4,
          },
          n: { type: "noul", noul: 0.2 },
          s: { type: "score", score: 3 },
        },
        usage: { input_tokens: 10, output_tokens: 1 },
      }),
    );
    const res = await askJev({
      apiKey: "k",
      state: "x",
      questions: { c: question },
    });
    expect(res.model).toBe("jev-1.13.0");
    expect(res.answers.c).toMatchObject({ type: "choice", choice: "a" });
    expect(res.answers.n).toEqual({ type: "noul", noul: 0.2 });
    expect(res.answers.s).toEqual({ type: "score", score: 3 });
    expect(res.usage).toEqual({ input_tokens: 10, output_tokens: 1 });
  });

  it("非 2xx はステータス付きの JevHttpError を throw する", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      askJev({ apiKey: "k", state: "x", questions: { q: question } }),
    ).rejects.toMatchObject({ status: 429 });
    fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 529 }));
    await expect(
      askJev({ apiKey: "k", state: "x", questions: { q: question } }),
    ).rejects.toBeInstanceOf(JevHttpError);
  });

  it("確率が 0〜1 の範囲外なら throw する", async () => {
    fetchSpy.mockResolvedValueOnce(
      ok({
        answers: {
          q: { type: "choice", choice: "a", probabilities: { a: 1.5 } },
        },
      }),
    );
    await expect(
      askJev({ apiKey: "k", state: "x", questions: { q: question } }),
    ).rejects.toThrow();
  });

  it("answers が無い応答は throw する", async () => {
    fetchSpy.mockResolvedValueOnce(ok({ model: "jev-1.13.0" }));
    await expect(
      askJev({ apiKey: "k", state: "x", questions: { q: question } }),
    ).rejects.toThrow();
  });
});
