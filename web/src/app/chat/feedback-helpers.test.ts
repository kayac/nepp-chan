import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  extractConversationContext,
  extractToolExecutions,
  getToolNameFromPart,
} from "./feedback-helpers";

const textPart = (text: string) => ({ type: "text" as const, text });

const userMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [textPart(text)],
});

const assistantMessage = (
  id: string,
  parts: UIMessage["parts"],
): UIMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("getToolNameFromPart", () => {
  it("toolName が直接付いていればそれを返す", () => {
    expect(
      getToolNameFromPart({ type: "tool-call", toolName: "weather" }),
    ).toBe("weather");
  });

  it("toolName が無い場合は type の `tool-` プレフィックスを剥がす", () => {
    expect(getToolNameFromPart({ type: "tool-search" })).toBe("search");
  });

  it("プレフィックスが無ければ type をそのまま返す", () => {
    expect(getToolNameFromPart({ type: "unknown" })).toBe("unknown");
  });
});

describe("extractConversationContext", () => {
  const messages = [
    userMessage("u-1", "天気は？"),
    assistantMessage("a-1", [textPart("晴れです")]),
    userMessage("u-2", "明日は？"),
  ];

  it("target が無ければ null を返す", () => {
    expect(extractConversationContext(messages, "missing")).toBeNull();
  });

  it("先頭メッセージなら previousMessages は空配列", () => {
    const ctx = extractConversationContext(messages, "u-1");
    expect(ctx).not.toBeNull();
    expect(ctx?.previousMessages).toEqual([]);
    expect(ctx?.targetMessage).toEqual({
      id: "u-1",
      role: "user",
      content: "天気は？",
    });
  });

  it("途中のメッセージなら直前 1 件を previousMessages に入れる", () => {
    const ctx = extractConversationContext(messages, "a-1");
    expect(ctx?.previousMessages).toEqual([
      { id: "u-1", role: "user", content: "天気は？" },
    ]);
    expect(ctx?.nextMessages).toEqual([]);
  });
});

describe("extractToolExecutions", () => {
  it("tool part のみを ToolExecution にマップする", () => {
    const message = assistantMessage("a-1", [
      textPart("会話"),
      {
        type: "tool-search",
        toolCallId: "t-1",
        state: "result",
        input: { q: "音威子府" },
        output: { hits: 3 },
        // biome-ignore lint/suspicious/noExplicitAny: 簡易な擬似 tool part
      } as any,
      {
        type: "tool-weather",
        toolCallId: "t-2",
        state: "error",
        input: {},
        errorText: "API 失敗",
        // biome-ignore lint/suspicious/noExplicitAny: 簡易な擬似 tool part
      } as any,
    ]);

    const executions = extractToolExecutions(message);
    expect(executions).toEqual([
      {
        toolName: "search",
        state: "result",
        input: { q: "音威子府" },
        output: { hits: 3 },
        errorText: undefined,
      },
      {
        toolName: "weather",
        state: "error",
        input: {},
        output: undefined,
        errorText: "API 失敗",
      },
    ]);
  });

  it("tool part が無いなら空配列", () => {
    const message = assistantMessage("a-2", [textPart("text only")]);
    expect(extractToolExecutions(message)).toEqual([]);
  });
});
