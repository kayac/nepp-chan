import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { messageText } from "./message-text";

const textPart = (text: string) => ({ type: "text" as const, text });

const assistantMessage = (
  id: string,
  parts: UIMessage["parts"],
): UIMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("messageText", () => {
  it("text part のみを連結する", () => {
    const message = assistantMessage("a-1", [
      textPart("はじめまして"),
      textPart("、"),
      textPart("ねっぷちゃんです"),
    ]);
    expect(messageText(message)).toBe("はじめまして、ねっぷちゃんです");
  });

  it("text 以外の part は無視する", () => {
    const message = assistantMessage("a-2", [
      textPart("前置き"),
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の異種 part
      { type: "tool-call", toolCallId: "t-1", toolName: "x", args: {} } as any,
      textPart("締めくくり"),
    ]);
    expect(messageText(message)).toBe("前置き締めくくり");
  });

  it("text が無い場合は空文字を返す", () => {
    const message = assistantMessage("a-3", []);
    expect(messageText(message)).toBe("");
  });
});
