import { describe, expect, it } from "vitest";
import { parseErrorResponse } from "./errors";

describe("parseErrorResponse", () => {
  const jsonRes = (body: unknown, status = 500) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("error.message を最優先で返す", async () => {
    const msg = await parseErrorResponse(
      jsonRes({ error: { message: "deep" }, message: "fallback" }),
    );

    expect(msg).toBe("deep");
  });

  it("error.message が無ければ message を返す", async () => {
    const msg = await parseErrorResponse(jsonRes({ message: "shallow" }));

    expect(msg).toBe("shallow");
  });

  it("どちらも無ければ status 入りの汎用文言を返す", async () => {
    const msg = await parseErrorResponse(jsonRes({}, 503));

    expect(msg).toBe("リクエストに失敗しました (503)");
  });

  it("JSON parse 失敗時も status 入りの汎用文言を返す", async () => {
    const res = new Response("not-json", { status: 502 });
    const msg = await parseErrorResponse(res);

    expect(msg).toBe("リクエストに失敗しました (502)");
  });
});
