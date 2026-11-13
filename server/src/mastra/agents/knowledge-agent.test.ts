import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_AGENT_ID,
  KNOWLEDGE_SEARCH_MAX_STEPS,
  knowledgeFinalStepGuard,
  pinKnowledgeAgentSteps,
} from "./knowledge-agent";

const systemMessages = [{ role: "system" as const, content: "base" }];

describe("knowledgeFinalStepGuard", () => {
  it("検索の手数が残っている間は何も変えない", () => {
    expect(
      knowledgeFinalStepGuard({ stepNumber: 0, systemMessages }),
    ).toBeUndefined();
    expect(
      knowledgeFinalStepGuard({
        stepNumber: KNOWLEDGE_SEARCH_MAX_STEPS - 1,
        systemMessages,
      }),
    ).toBeUndefined();
  });

  it("手数を使い切った最後の手ではツールを止めて調査メモを書かせる", () => {
    const result = knowledgeFinalStepGuard({
      stepNumber: KNOWLEDGE_SEARCH_MAX_STEPS,
      systemMessages,
    });
    expect(result?.toolChoice).toBe("none");
    expect(result?.systemMessages?.[0]).toEqual(systemMessages[0]);
    expect(result?.systemMessages).toHaveLength(2);
    expect(String(result?.systemMessages?.[1]?.content)).toContain("調査メモ");
  });
});

describe("pinKnowledgeAgentSteps", () => {
  it("親が渡した手数に関わらず検索 5 手 + メモ 1 手に固定する", () => {
    expect(pinKnowledgeAgentSteps({ primitiveId: KNOWLEDGE_AGENT_ID })).toEqual(
      {
        modifiedMaxSteps: KNOWLEDGE_SEARCH_MAX_STEPS + 1,
      },
    );
  });

  it("ほかのサブエージェントには関与しない", () => {
    expect(
      pinKnowledgeAgentSteps({ primitiveId: "web-researcher-agent" }),
    ).toBeUndefined();
  });
});
