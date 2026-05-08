import { describe, expect, it } from "vitest";

import { ApiError, parseErrorResponse } from "./client";

describe("parseErrorResponse", () => {
  it("error.message を最優先で抽出", async () => {
    const res = new Response(
      JSON.stringify({ error: { message: "認可エラー" } }),
      { status: 403 },
    );
    expect(await parseErrorResponse(res)).toBe("認可エラー");
  });

  it("error.message が無ければ message を見る", async () => {
    const res = new Response(JSON.stringify({ message: "shallow" }), {
      status: 400,
    });
    expect(await parseErrorResponse(res)).toBe("shallow");
  });

  it("どちらも無いと汎用メッセージ + status", async () => {
    const res = new Response(JSON.stringify({}), { status: 500 });
    expect(await parseErrorResponse(res)).toMatch(/500/);
  });

  it("JSON でなくても throw せず汎用メッセージ", async () => {
    const res = new Response("not json", { status: 502 });
    expect(await parseErrorResponse(res)).toMatch(/502/);
  });
});

describe("ApiError", () => {
  it("status を保持し name は ApiError", () => {
    const err = new ApiError("失敗", 418);
    expect(err.status).toBe(418);
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("失敗");
    expect(err).toBeInstanceOf(Error);
  });
});
