import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./webhook-signature";

const SECRET = "wsec_test_secret";
const BODY = '{"type":"post_call_transcription","data":{}}';

const sign = (timestamp: number, body: string, secret = SECRET) =>
  `t=${timestamp},v0=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;

const NOW = 1_800_000_000_000;
const nowSeconds = Math.floor(NOW / 1000);
const verify = (header: string | undefined, body = BODY) =>
  verifyWebhookSignature({ header, body, secret: SECRET, now: NOW });

describe("verifyWebhookSignature", () => {
  it("timestamp.body の HMAC-SHA256 hex が v0 と一致すれば受理する", async () => {
    await expect(verify(sign(nowSeconds, BODY))).resolves.toBe(true);
  });

  it("body が改ざんされていれば拒否する", async () => {
    await expect(verify(sign(nowSeconds, BODY), `${BODY} `)).resolves.toBe(
      false,
    );
  });

  it("別の secret で署名されていれば拒否する", async () => {
    await expect(verify(sign(nowSeconds, BODY, "other"))).resolves.toBe(false);
  });

  it("timestamp が 30 分より古ければ署名が正しくても拒否する", async () => {
    await expect(verify(sign(nowSeconds - 30 * 60 - 1, BODY))).resolves.toBe(
      false,
    );
  });

  it("timestamp がちょうど 30 分前なら受理する", async () => {
    await expect(verify(sign(nowSeconds - 30 * 60, BODY))).resolves.toBe(true);
  });

  it.each([
    ["ヘッダなし", undefined],
    ["空文字", ""],
    ["t だけ", `t=${nowSeconds}`],
    ["v0 だけ", "v0=abcd"],
    ["別スキーム", `t=${nowSeconds},v1=abcd`],
  ])("ヘッダが不正（%s）なら拒否する", async (_label, header) => {
    await expect(verify(header)).resolves.toBe(false);
  });
});
