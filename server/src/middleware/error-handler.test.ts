import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./error-handler";

type ErrorResponse = {
  error: {
    code: StatusCode;
    message: string;
  };
};

describe("グローバルエラーハンドラー", () => {
  const createTestApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    return app;
  };

  describe("HTTPException の処理", () => {
    it("HTTPException を適切な JSON レスポンスに変換する", async () => {
      const app = createTestApp();
      app.get("/test", () => {
        throw new HTTPException(400, { message: "Bad Request" });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(400);
      const json: ErrorResponse = await res.json();
      expect(json).toEqual({
        error: {
          code: 400,
          message: "Bad Request",
        },
      });
    });

    it("500 エラーをログ出力する", async () => {
      const app = createTestApp();
      app.get("/test", () => {
        throw new HTTPException(500, { message: "Server Error" });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json: ErrorResponse = await res.json();
      expect(json.error.code).toBe(500);
    });
  });

  describe("一般的な Error の処理", () => {
    it("一般的な Error を 500 レスポンスに変換する", async () => {
      const app = createTestApp();
      app.get("/test", () => {
        throw new Error("Something went wrong");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json: ErrorResponse = await res.json();
      expect(json).toEqual({
        error: {
          code: 500,
          message:
            "内部エラーが発生しました。しばらく経ってからお試しください。",
        },
      });
    });
  });
});
