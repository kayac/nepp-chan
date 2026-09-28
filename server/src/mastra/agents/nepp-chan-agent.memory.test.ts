import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AgentModelConfig } from "~/lib/llm-models";
import { researchToolName } from "~/mastra/tools/research-tool";
import { createNeppChanAgent } from "./nepp-chan-agent";

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const toolCallTurn = (id: string, question: string) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: "stream-start" as const, warnings: [] },
      {
        type: "tool-call" as const,
        toolCallId: id,
        toolName: researchToolName,
        input: JSON.stringify({ question }),
      },
      {
        type: "finish" as const,
        finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
        usage,
      },
    ],
  }),
});

const textTurn = (text: string) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: "stream-start" as const, warnings: [] },
      { type: "text-start" as const, id: "t" },
      { type: "text-delta" as const, id: "t", delta: text },
      { type: "text-end" as const, id: "t" },
      {
        type: "finish" as const,
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage,
      },
    ],
  }),
});

describe("createNeppChanAgent の memory", () => {
  it("前のターンの調査メモは読み込まず、今のターンの調査メモは本体に渡す", async () => {
    const turns = [
      toolCallTurn("c1", "寮費は？"),
      textTurn("寮費は月額3万円だよ"),
      toolCallTurn("c2", "食費は？"),
      textTurn("食費も込みだよ"),
    ];
    const model = new MockLanguageModelV3({
      doStream: async () => {
        const next = turns.shift();
        if (!next) throw new Error("no more turns");
        return next;
      },
    });
    const memos = ["MEMO_TURN_1", "MEMO_TURN_2"];
    const agent = createNeppChanAgent({
      modelConfig: { model } as unknown as AgentModelConfig,
      withMemory: false,
      memory: new Memory({
        storage: new LibSQLStore({ id: "memory-test", url: ":memory:" }),
      }),
      tools: {
        [researchToolName]: createTool({
          id: "research",
          description: "調べる",
          inputSchema: z.object({ question: z.string() }),
          outputSchema: z.object({ memo: z.string() }),
          execute: async () => ({ memo: memos.shift() ?? "" }),
        }),
      },
    });
    const ask = async (text: string) => {
      const stream = await agent.stream(text, {
        memory: { thread: "t1", resource: "r1" },
      });
      await stream.consumeStream();
    };

    await ask("寮費は？");
    await ask("食費は？");

    const prompts = model.doStreamCalls.map((call) =>
      JSON.stringify(call.prompt),
    );
    expect(prompts[1]).toContain("MEMO_TURN_1");
    expect(prompts[2]).toContain("寮費は月額3万円だよ");
    expect(prompts[2]).not.toContain("MEMO_TURN_1");
    expect(prompts[3]).toContain("MEMO_TURN_2");
  });
});
