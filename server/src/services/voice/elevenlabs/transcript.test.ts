import { describe, expect, it } from "vitest";
import { pairTranscriptTurns, type TranscriptEntry } from "./transcript";

const user = (message: string): TranscriptEntry => ({ role: "user", message });
const agent = (message: string | null): TranscriptEntry => ({
  role: "agent",
  message,
});

describe("pairTranscriptTurns", () => {
  it("user と agent が交互なら 1 発話ずつペアにする", () => {
    expect(
      pairTranscriptTurns([
        user("こんにちは"),
        agent("やあ、ねっぷちゃんだよ"),
        user("バスの時間は？"),
        agent("8時だよ"),
      ]),
    ).toEqual([
      { userText: "こんにちは", assistantText: "やあ、ねっぷちゃんだよ" },
      { userText: "バスの時間は？", assistantText: "8時だよ" },
    ]);
  });

  it("最初の agent 発話（first_message）は user の発話がないので捨てる", () => {
    expect(
      pairTranscriptTurns([
        agent("もしもし、ねっぷちゃんだよ"),
        user("こんにちは"),
        agent("やあ"),
      ]),
    ).toEqual([{ userText: "こんにちは", assistantText: "やあ" }]);
  });

  it("agent の連続発話は空白で結合して 1 ターンにする", () => {
    expect(
      pairTranscriptTurns([
        user("教えて"),
        agent("ちょっと待ってね"),
        agent("8時だよ"),
      ]),
    ).toEqual([
      { userText: "教えて", assistantText: "ちょっと待ってね 8時だよ" },
    ]);
  });

  it("user の連続発話は空白で結合して 1 ターンにする", () => {
    expect(
      pairTranscriptTurns([
        user("あのね"),
        user("バスの時間"),
        agent("8時だよ"),
      ]),
    ).toEqual([{ userText: "あのね バスの時間", assistantText: "8時だよ" }]);
  });

  it("message が null か空の行は無視する", () => {
    expect(
      pairTranscriptTurns([
        user("教えて"),
        agent(null),
        agent(""),
        agent("8時だよ"),
      ]),
    ).toEqual([{ userText: "教えて", assistantText: "8時だよ" }]);
  });

  it("最後の user 発話に agent の返答がなければそのターンは捨てる", () => {
    expect(
      pairTranscriptTurns([
        user("こんにちは"),
        agent("やあ"),
        user("じゃあね"),
      ]),
    ).toEqual([{ userText: "こんにちは", assistantText: "やあ" }]);
  });

  it("空の transcript は空配列を返す", () => {
    expect(pairTranscriptTurns([])).toEqual([]);
  });
});
