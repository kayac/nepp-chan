import { describe, expect, it } from "vitest";

import { parseFeedback } from "./feedback";

const baseRow = {
  id: "fb-1",
  threadId: "t-1",
  messageId: "m-1",
  rating: "good",
  category: null,
  comment: null,
  conversationContext: JSON.stringify({
    targetMessage: { id: "m-1", role: "assistant", content: "x" },
    previousMessages: [],
    nextMessages: [],
  }),
  toolExecutions: null,
  createdAt: "2025-01-01T00:00:00Z",
  resolvedAt: null,
};

describe("parseFeedback", () => {
  it("conversationContext を JSON パースして返す", () => {
    const result = parseFeedback(baseRow);

    expect(result.conversationContext).toEqual({
      targetMessage: { id: "m-1", role: "assistant", content: "x" },
      previousMessages: [],
      nextMessages: [],
    });
  });

  it("toolExecutions が null なら null を保持", () => {
    const result = parseFeedback(baseRow);
    expect(result.toolExecutions).toBeNull();
  });

  it("toolExecutions の JSON を配列にパースする", () => {
    const tools = [
      { toolName: "search", state: "success" as const, input: { q: "雪" } },
    ];
    const result = parseFeedback({
      ...baseRow,
      toolExecutions: JSON.stringify(tools),
    });

    expect(result.toolExecutions).toEqual(tools);
  });

  it("壊れた conversationContext JSON は default にフォールバック", () => {
    const result = parseFeedback({
      ...baseRow,
      conversationContext: "not-json{{",
    });

    expect(result.conversationContext).toEqual({
      targetMessage: { id: "", role: "", content: "" },
      previousMessages: [],
      nextMessages: [],
    });
  });

  it("壊れた toolExecutions JSON は空配列にフォールバック", () => {
    const result = parseFeedback({
      ...baseRow,
      toolExecutions: "broken",
    });

    expect(result.toolExecutions).toEqual([]);
  });

  it("rating / category の値はそのまま保持", () => {
    const result = parseFeedback({
      ...baseRow,
      rating: "bad",
      category: "incorrect_fact",
    });

    expect(result.rating).toBe("bad");
    expect(result.category).toBe("incorrect_fact");
  });
});
