import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "~/test/msw-server";
import { fetchCallToken } from "./api";

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
});
