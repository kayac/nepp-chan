import { describe, expect, it } from "vitest";
import type { MessageFeedback } from "~/types";
import {
  countResolvedAndUnresolved,
  filterFeedbacksByResolved,
} from "./feedback-helpers";

const fb = (id: string, resolvedAt: string | null): MessageFeedback =>
  ({
    id,
    threadId: "t",
    messageId: "m",
    rating: "good",
    category: null,
    comment: null,
    conversationContext: {
      targetMessage: { id: "m", role: "assistant", content: "x" },
      previousMessages: [],
      nextMessages: [],
    },
    toolExecutions: null,
    createdAt: "2025-01-01T00:00:00Z",
    resolvedAt,
  }) as MessageFeedback;

describe("filterFeedbacksByResolved", () => {
  const list = [fb("a", null), fb("b", "2025-01-01T00:00:00Z"), fb("c", null)];

  it("'unresolved': resolvedAt が null のものだけ", () => {
    const result = filterFeedbacksByResolved(list, "unresolved");
    expect(result.map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("'resolved': resolvedAt が非 null のものだけ", () => {
    const result = filterFeedbacksByResolved(list, "resolved");
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });

  it("'all': 全件返す（コピーで返す）", () => {
    const result = filterFeedbacksByResolved(list, "all");
    expect(result).toHaveLength(3);
    expect(result).not.toBe(list);
  });

  it("空配列はそのまま空", () => {
    expect(filterFeedbacksByResolved([], "unresolved")).toEqual([]);
    expect(filterFeedbacksByResolved([], "all")).toEqual([]);
  });
});

describe("countResolvedAndUnresolved", () => {
  it("解決済 / 未解決を数える", () => {
    const result = countResolvedAndUnresolved([
      fb("a", null),
      fb("b", "x"),
      fb("c", null),
      fb("d", "y"),
    ]);
    expect(result).toEqual({ unresolved: 2, resolved: 2 });
  });

  it("空配列なら 0 / 0", () => {
    expect(countResolvedAndUnresolved([])).toEqual({
      unresolved: 0,
      resolved: 0,
    });
  });
});
