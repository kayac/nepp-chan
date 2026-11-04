import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "~/test/msw-server";
import { fetchSignedUrl } from "./api";

const API = "http://localhost:8787";

describe("fetchSignedUrl", () => {
  it("signedUrl を返す", async () => {
    server.use(
      http.post(`${API}/elevenlabs/voice/signed-url`, () =>
        HttpResponse.json({ signedUrl: "wss://el/x" }),
      ),
    );
    await expect(fetchSignedUrl()).resolves.toBe("wss://el/x");
  });

  it("非 200 なら throw する", async () => {
    server.use(
      http.post(`${API}/elevenlabs/voice/signed-url`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    await expect(fetchSignedUrl()).rejects.toThrow();
  });

  it.each([401, 403])(
    "%i なら管理者ログインを促すメッセージで throw する",
    async (status) => {
      server.use(
        http.post(`${API}/elevenlabs/voice/signed-url`, () =>
          HttpResponse.json(
            { error: { code: status, message: "認証が必要です" } },
            { status },
          ),
        ),
      );
      await expect(fetchSignedUrl()).rejects.toThrow(
        "管理者ログインが必要です",
      );
    },
  );
});
