import { describe, expect, it } from "vitest";
import { base64UrlToString, hmacSha256 } from "~/lib/crypto";
import {
  createRelayToken,
  createVoiceAccessToken,
  verifyRelayToken,
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

describe("createRelayToken / verifyRelayToken", () => {
  const SECRET = "relay-secret";

  it("発行したトークンを検証して有効期限内の payload を取り出せる", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: 1000,
      ttlSeconds: 300,
    });
    const payload = await verifyRelayToken(token, SECRET, { nowSeconds: 1010 });
    expect(payload).toEqual({ iat: 1000, exp: 1300 });
  });

  it("有効期限切れは null", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: 1000,
      ttlSeconds: 60,
    });
    expect(
      await verifyRelayToken(token, SECRET, { nowSeconds: 1061 }),
    ).toBeNull();
  });

  it("改ざんされたペイロードは null", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: 1000,
      ttlSeconds: 300,
    });
    const tampered = `${"x"}${token.slice(1)}`;
    expect(
      await verifyRelayToken(tampered, SECRET, { nowSeconds: 1010 }),
    ).toBeNull();
  });

  it("異なる secret では検証に失敗する", async () => {
    const token = await createRelayToken(SECRET, {
      nowSeconds: 1000,
      ttlSeconds: 300,
    });
    expect(
      await verifyRelayToken(token, "other-secret", { nowSeconds: 1010 }),
    ).toBeNull();
  });

  it("形式不正（セグメント不足）は null", async () => {
    expect(
      await verifyRelayToken("not-a-token", SECRET, { nowSeconds: 1010 }),
    ).toBeNull();
  });
});
