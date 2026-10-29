import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));
vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));
vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));
const { runResearchMock, handlePostCallEventMock } = vi.hoisted(() => ({
  runResearchMock: vi.fn(),
  handlePostCallEventMock: vi.fn(),
}));
vi.mock("~/services/voice/elevenlabs/research", () => ({
  runResearch: runResearchMock,
}));
vi.mock("~/services/voice/elevenlabs/post-call", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/services/voice/elevenlabs/post-call")
  >()),
  handlePostCallEvent: handlePostCallEventMock,
}));

const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { hmacSha256Hex } = await import("~/lib/crypto");
const { elevenlabsVoiceRoutes } = await import("./voice");
const { withResolvePrincipal } = await import("~/__tests__/helpers/test-app");

const parent = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
parent.route("/elevenlabs/voice", elevenlabsVoiceRoutes);
const app = await withResolvePrincipal(parent);

const env = {
  DB: {} as D1Database,
  RESOURCE_ID_HASH_SECRET: "resource-secret",
  ELEVENLABS_API_KEY: "xi-key",
  ELEVENLABS_AGENT_ID: "agent_1",
  ELEVENLABS_TOOL_SECRET: "tool-secret",
  ELEVENLABS_WEBHOOK_SECRET: "webhook-secret",
} as unknown as CloudflareBindings;

const BASE = "http://api.example.com/elevenlabs/voice";
const ADMIN_TOKEN = "a".repeat(64);

const useAdminAuth = () => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: ADMIN_TOKEN,
    userId: "u-1",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue({
    id: "u-1",
    username: "staff01",
    name: "スタッフ",
    role: "staff",
    passwordHash: "hash",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: null,
  });
};

beforeEach(() => {
  vi.mocked(adminSessionRepository.findValid).mockReset();
  vi.mocked(adminUserRepository.findById).mockReset();
  runResearchMock.mockReset();
  handlePostCallEventMock.mockReset();
  vi.unstubAllGlobals();
});

describe("POST /elevenlabs/voice/signed-url", () => {
  it("未認証は 401", async () => {
    const res = await app.request(
      `${BASE}/signed-url`,
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("管理者には ElevenLabs から取得した signed URL を返す", async () => {
    useAdminAuth();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ signed_url: "wss://el/x" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await app.request(
      `${BASE}/signed-url`,
      { method: "POST", headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedUrl: "wss://el/x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("agent_id=agent_1");
    expect(init.headers["xi-api-key"]).toBe("xi-key");
  });

  it("ElevenLabs が失敗したら 500", async () => {
    useAdminAuth();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );
    const res = await app.request(
      `${BASE}/signed-url`,
      { method: "POST", headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
      env,
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /elevenlabs/voice/research", () => {
  const post = (secret: string | undefined, body: unknown) =>
    app.request(
      `${BASE}/research`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-nepp-tool-secret": secret } : {}),
        },
        body: JSON.stringify(body),
      },
      env,
    );

  it("ツール secret が無い・違うなら 401 で調べ物を始めない", async () => {
    expect((await post(undefined, { question: "q" })).status).toBe(401);
    expect((await post("wrong", { question: "q" })).status).toBe(401);
    expect(runResearchMock).not.toHaveBeenCalled();
  });

  it("question を渡して answer を返す", async () => {
    runResearchMock.mockResolvedValue("8時だよ");
    const res = await post("tool-secret", { question: "バスの時間" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: "8時だよ" });
    expect(runResearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ question: "バスの時間" }),
    );
  });
});

describe("POST /elevenlabs/voice/post-call", () => {
  const payload = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: 1,
    data: { conversation_id: "conv_1", transcript: [] },
  });
  const signed = async (body: string, secret = "webhook-secret") => {
    const t = Math.floor(Date.now() / 1000);
    return `t=${t},v0=${await hmacSha256Hex(`${t}.${body}`, secret)}`;
  };
  const post = (body: string, signature?: string) =>
    app.request(
      `${BASE}/post-call`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(signature ? { "elevenlabs-signature": signature } : {}),
        },
        body,
      },
      env,
    );

  it("署名が無い・不正なら 401 で保存しない", async () => {
    expect((await post(payload)).status).toBe(401);
    expect((await post(payload, await signed(payload, "other"))).status).toBe(
      401,
    );
    expect(handlePostCallEventMock).not.toHaveBeenCalled();
  });

  it("署名が正しければイベントを処理して結果を返す", async () => {
    handlePostCallEventMock.mockResolvedValue({ outcome: "saved", turns: 2 });
    const res = await post(payload, await signed(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "saved", turns: 2 });
    expect(handlePostCallEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ type: "post_call_transcription" }),
      }),
    );
  });

  it("保存に失敗したら 500 を返して ElevenLabs の再送に任せる", async () => {
    handlePostCallEventMock.mockRejectedValue(new Error("D1 down"));
    const res = await post(payload, await signed(payload));
    expect(res.status).toBe(500);
  });
});
