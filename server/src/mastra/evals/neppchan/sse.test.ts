import { describe, expect, it } from "vitest";
import { parseChatStream } from "./sse";

const lines = (...events: object[]) =>
  events.map((e) => `data: ${JSON.stringify(e)}`).join("\n");

describe("parseChatStream", () => {
  it("text-end 区切りで前置きと本文を分け、ツール名を重複なく集める", () => {
    const raw = lines(
      { type: "text-delta", delta: "調べて" },
      { type: "text-delta", delta: "くるね" },
      { type: "text-end" },
      { type: "tool-input-start", toolName: "agent-knowledgeAgent" },
      { type: "tool-input-start", toolName: "agent-knowledgeAgent" },
      { type: "text-delta", delta: "本文だよ" },
    );
    expect(parseChatStream(`${raw}\ndata: [DONE]`)).toEqual({
      text: "調べてくるね\n\n本文だよ",
      tools: ["agent-knowledgeAgent"],
    });
  });

  it("error イベントは例外にする", () => {
    expect(() =>
      parseChatStream(lines({ type: "error", errorText: "rate limited" })),
    ).toThrow("rate limited");
  });

  it("壊れた JSON は握りつぶさない", () => {
    expect(() => parseChatStream("data: {oops")).toThrow();
  });
});
