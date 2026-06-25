import { describe, expect, it } from "vitest";
import {
  parseRelayMessage,
  serializeRelayMessage,
  textTokenMessage,
} from "./relay-protocol";

describe("parseRelayMessage", () => {
  it("setup を型付きで解釈し、未使用フィールドも保持する", () => {
    const raw = JSON.stringify({
      type: "setup",
      sessionId: "VX123",
      callSid: "CA123",
      from: "client:tester",
      to: "+18005550101",
      direction: "inbound",
      callType: "PSTN",
      customParameters: { token: "abc" },
    });
    const msg = parseRelayMessage(raw);
    expect(msg?.type).toBe("setup");
    if (msg?.type !== "setup") throw new Error("type narrowing failed");
    expect(msg.from).toBe("client:tester");
    expect(msg.callSid).toBe("CA123");
    expect(msg.customParameters).toEqual({ token: "abc" });
  });

  it("prompt の文字起こしテキストと last を取り出す", () => {
    const raw = JSON.stringify({
      type: "prompt",
      voicePrompt: "音威子府そばって美味しいの？",
      lang: "ja-JP",
      last: true,
    });
    const msg = parseRelayMessage(raw);
    if (msg?.type !== "prompt") throw new Error("expected prompt");
    expect(msg.voicePrompt).toBe("音威子府そばって美味しいの？");
    expect(msg.last).toBe(true);
    expect(msg.lang).toBe("ja-JP");
  });

  it("interrupt を解釈する（barge-in）", () => {
    const raw = JSON.stringify({
      type: "interrupt",
      utteranceUntilInterrupt: "音威子府は",
      durationUntilInterruptMs: 460,
    });
    const msg = parseRelayMessage(raw);
    expect(msg?.type).toBe("interrupt");
  });

  it("dtmf / error も既知の型として解釈する", () => {
    expect(
      parseRelayMessage(JSON.stringify({ type: "dtmf", digit: "1" }))?.type,
    ).toBe("dtmf");
    expect(
      parseRelayMessage(JSON.stringify({ type: "error", description: "x" }))
        ?.type,
    ).toBe("error");
  });

  it("不正な JSON は null を返す", () => {
    expect(parseRelayMessage("not json")).toBeNull();
  });

  it("未知の type は null を返す（将来のメッセージ追加を無視）", () => {
    expect(
      parseRelayMessage(JSON.stringify({ type: "future-thing" })),
    ).toBeNull();
  });

  it("必須フィールド欠落は null を返す", () => {
    expect(parseRelayMessage(JSON.stringify({ type: "prompt" }))).toBeNull();
  });
});

describe("textTokenMessage", () => {
  it("token と last=false の text メッセージを作る", () => {
    expect(textTokenMessage("こんにちは")).toEqual({
      type: "text",
      token: "こんにちは",
      last: false,
    });
  });

  it("last=true でターン終端を示せる", () => {
    expect(textTokenMessage("またね", true)).toEqual({
      type: "text",
      token: "またね",
      last: true,
    });
  });
});

describe("serializeRelayMessage", () => {
  it("送信メッセージを JSON 文字列化して往復できる", () => {
    const msg = textTokenMessage("やあ", true);
    expect(JSON.parse(serializeRelayMessage(msg))).toEqual(msg);
  });
});
