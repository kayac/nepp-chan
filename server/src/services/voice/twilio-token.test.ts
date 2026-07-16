import { afterEach, describe, expect, it, vi } from "vitest";
import { base64UrlToString, hmacSha256 } from "~/lib/crypto";
import {
  createRelayToken,
  createVoiceAccessToken,
  verifyRelayToken,
  verifySetupToken,
} from "./twilio-token";

const ACCESS_PARAMS = {
  accountSid: "AC00000000000000000000000000000000",
  apiKeySid: "SK00000000000000000000000000000000",
  apiKeySecret: "api-key-secret",
  identity: "dev-tester",
  twimlAppSid: "AP00000000000000000000000000000000",
  nowSeconds: 1_700_000_000,
};

describe("createVoiceAccessToken", () => {
  it("3 セグメントの JWT を返す", async () => {
    const jwt = await createVoiceAccessToken(ACCESS_PARAMS);
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("ヘッダーに Twilio 固有の cty / HS256 を持つ", async () => {
    const jwt = await createVoiceAccessToken(ACCESS_PARAMS);
    const header = JSON.parse(base64UrlToString(jwt.split(".")[0]));
    expect(header).toEqual({ cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" });
  });

  it("ペイロードに iss/sub/VoiceGrant を含む", async () => {
    const jwt = await createVoiceAccessToken(ACCESS_PARAMS);
    const payload = JSON.parse(base64UrlToString(jwt.split(".")[1]));
    expect(payload.iss).toBe(ACCESS_PARAMS.apiKeySid);
    expect(payload.sub).toBe(ACCESS_PARAMS.accountSid);
    expect(payload.grants.identity).toBe("dev-tester");
    expect(payload.grants.voice.outgoing.application_sid).toBe(
      ACCESS_PARAMS.twimlAppSid,
    );
  });

  it("exp は iat + ttl（既定 3600 秒）", async () => {
    const jwt = await createVoiceAccessToken(ACCESS_PARAMS);
    const payload = JSON.parse(base64UrlToString(jwt.split(".")[1]));
    expect(payload.iat).toBe(ACCESS_PARAMS.nowSeconds);
    expect(payload.exp).toBe(ACCESS_PARAMS.nowSeconds + 3600);
  });

  it("ttlSeconds を上書きできる", async () => {
    const jwt = await createVoiceAccessToken({
      ...ACCESS_PARAMS,
      ttlSeconds: 120,
    });
    const payload = JSON.parse(base64UrlToString(jwt.split(".")[1]));
    expect(payload.exp).toBe(ACCESS_PARAMS.nowSeconds + 120);
  });

  it("署名は API Key Secret による HS256（先頭2セグメント上）で検証できる", async () => {
    const jwt = await createVoiceAccessToken(ACCESS_PARAMS);
    const [h, p, sig] = jwt.split(".");
    const expected = await hmacSha256(`${h}.${p}`, ACCESS_PARAMS.apiKeySecret);
    expect(sig).toBe(expected);
  });
});

describe("createRelayToken / verifyRelayToken（hono/jwt ベース）", () => {
  const SECRET = "relay-secret";

  afterEach(() => {
    vi.useRealTimers();
  });

  it("発行したトークンを検証して有効期限内の payload を取り出せる", async () => {
    const nowMs = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    const nowSeconds = Math.floor(nowMs / 1000);

    const token = await createRelayToken(SECRET, {
      nowSeconds,
      ttlSeconds: 300,
    });
    const payload = await verifyRelayToken(token, SECRET);
    expect(payload).toMatchObject({ iat: nowSeconds, exp: nowSeconds + 300 });
  });

  it("有効期限切れは null", async () => {
    const nowMs = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    const nowSeconds = Math.floor(nowMs / 1000);

    const token = await createRelayToken(SECRET, {
      nowSeconds,
      ttlSeconds: 60,
    });
    vi.setSystemTime(nowMs + 61_000);
    expect(await verifyRelayToken(token, SECRET)).toBeNull();
  });

  it("改ざんされたトークンは null", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: Math.floor(Date.now() / 1000),
      ttlSeconds: 300,
    });
    const [header, payload, sig] = token.split(".");
    const tampered = `${header}.${payload}.${
      sig.startsWith("a") ? "b" : "a"
    }${sig.slice(1)}`;
    expect(await verifyRelayToken(tampered, SECRET)).toBeNull();
  });

  it("異なる secret では検証に失敗する", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: Math.floor(Date.now() / 1000),
      ttlSeconds: 300,
    });
    expect(await verifyRelayToken(token, "other-secret")).toBeNull();
  });

  it("形式不正（セグメント不足）は null", async () => {
    expect(await verifyRelayToken("not-a-token", SECRET)).toBeNull();
  });
});

describe("verifySetupToken", () => {
  const SECRET = "relay-secret";

  it("customParameters.token が正しければ claims を返す", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: Math.floor(Date.now() / 1000),
      ttlSeconds: 300,
    });
    const claims = await verifySetupToken({ token }, SECRET);
    expect(claims).not.toBeNull();
  });

  it("customParameters.token が不正なら null", async () => {
    expect(await verifySetupToken({ token: "invalid" }, SECRET)).toBeNull();
  });

  it("customParameters に token が無ければ null", async () => {
    expect(await verifySetupToken({}, SECRET)).toBeNull();
    expect(await verifySetupToken(undefined, SECRET)).toBeNull();
  });
});
