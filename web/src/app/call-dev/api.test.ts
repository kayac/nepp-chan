import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "~/test/msw-server";
import { fetchCallToken, fetchVoicePresets } from "./api";

const API = "http://localhost:8787";

describe("fetchCallToken", () => {
  it("token と identity を返す", async () => {
    server.use(
      http.post(`${API}/twilio/voice/token`, () =>
        HttpResponse.json({ token: "a.b.c", identity: "dev-123" }),
      ),
    );
    const result = await fetchCallToken();
    expect(result).toEqual({ token: "a.b.c", identity: "dev-123" });
  });

  it("非 200 なら throw する", async () => {
    server.use(
      http.post(`${API}/twilio/voice/token`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    await expect(fetchCallToken()).rejects.toThrow();
  });

  it.each([
    401, 403,
  ])("%i なら管理者ログインを促すメッセージで throw する", async (status) => {
    server.use(
      http.post(`${API}/twilio/voice/token`, () =>
        HttpResponse.json(
          { error: { code: status, message: "認証が必要です" } },
          { status },
        ),
      ),
    );
    await expect(fetchCallToken()).rejects.toThrow("管理者ログインが必要です");
  });
});

describe("fetchVoicePresets", () => {
  it("プリセット一覧と既定 ID を返す", async () => {
    const body = {
      defaultId: "morioki",
      presets: [{ id: "morioki", label: "Morioki" }],
    };
    server.use(
      http.get(`${API}/twilio/voice/presets`, () => HttpResponse.json(body)),
    );
    const result = await fetchVoicePresets();
    expect(result).toEqual(body);
  });

  it("非 200 なら throw する", async () => {
    server.use(
      http.get(`${API}/twilio/voice/presets`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    await expect(fetchVoicePresets()).rejects.toThrow();
  });
});
