import { randomUUID } from "node:crypto";
import type { Agent, AgentExecutionOptions } from "@mastra/core/agent";
import { runEvals } from "@mastra/core/evals";
import type { Memory } from "@mastra/memory";
import { conversationGates, type GateOutcome } from "./conversation-gate";
import { calledTools, responseText } from "./graders";
import type { PersonaCase } from "./schema";
import { createEvalTarget } from "./target";
import { addUsage, emptyUsage, type UsageTotals } from "./usage";

export { loadDevVars, serverRoot } from "./dev-vars";

export type CaseOutcome = {
  id: string;
  iteration: number;
  passed: boolean;
  gates: GateOutcome[];
  text: string;
  tools: string[];
  ms: number;
  model: string;
  usage: UsageTotals;
  error?: string;
};

// runEvals の turns は呼び出し側の thread を無視して毎回 randomUUID の thread を作るため、
// 最初の generate で決まった thread に seed を保存してから本来の generate に渡す。
// system ロールは Mastra の storage 読み出しで落ちるので、配信は assistant ロールで入れる
const seedOnFirstTurn = (
  agent: Agent,
  memory: Memory,
  resource: string,
  seed: readonly string[],
) => {
  const generate = agent.generate.bind(agent);
  let seeded = false;
  agent.generate = (async (
    input: Parameters<Agent["generate"]>[0],
    options?: AgentExecutionOptions,
  ) => {
    const thread = options?.memory?.thread;
    const threadId = typeof thread === "string" ? thread : thread?.id;
    if (!seeded && threadId) {
      seeded = true;
      await memory.createThread({ threadId, resourceId: resource });
      await memory.saveMessages({
        messages: seed.map((text, i) => ({
          id: `seed-${i}`,
          role: "assistant" as const,
          createdAt: new Date(Date.now() - 60_000),
          threadId,
          resourceId: resource,
          content: {
            format: 2 as const,
            parts: [{ type: "text" as const, text }],
          },
        })),
      });
    }
    return generate(input, options ?? {});
  }) as Agent["generate"];
};

const trackUsage = (agent: Agent, totals: UsageTotals) => {
  const generate = agent.generate.bind(agent);
  agent.generate = (async (
    input: Parameters<Agent["generate"]>[0],
    options?: AgentExecutionOptions,
  ) => {
    const result = await generate(input, options ?? {});
    addUsage(totals, result.totalUsage);
    return result;
  }) as Agent["generate"];
};

const isCodeGate = (id: string) =>
  id.startsWith("code:") || id.startsWith("check-");

export const evaluateCase = async (
  c: PersonaCase,
  iteration: number,
  onlyCode: boolean,
): Promise<CaseOutcome> => {
  const started = Date.now();
  const usage = emptyUsage();
  let model = "";
  const fail = (e: unknown): CaseOutcome => ({
    id: c.id,
    iteration,
    passed: false,
    gates: [],
    text: "",
    tools: [],
    ms: Date.now() - started,
    model,
    usage,
    error: e instanceof Error ? e.message : String(e),
  });

  const gates = onlyCode ? c.gates.filter((g) => isCodeGate(g.id)) : c.gates;
  const { scorers, outcomes, output } = conversationGates(gates, c.turns);
  const last = c.turns.length - 1;
  let passed: boolean;
  try {
    const target = createEvalTarget(c);
    const { agent, memory } = target;
    model = target.modelId;
    const resource = `eval-${c.id}-${randomUUID()}`;
    trackUsage(agent, usage);
    if (c.seed) seedOnFirstTurn(agent, memory, resource, c.seed);
    const result = await runEvals({
      target: agent,
      scorers: [],
      data: [
        {
          turns: c.turns.map((input, i) =>
            i === last ? { input, gates: scorers } : { input },
          ),
        },
      ],
      targetOptions: { memory: { resource } },
      concurrency: 1,
    });
    passed = result.verdict !== "failed";
  } catch (e) {
    return fail(e);
  }

  const out = output();
  return {
    id: c.id,
    iteration,
    passed,
    gates: outcomes,
    text: responseText(out),
    tools: calledTools(out),
    ms: Date.now() - started,
    model,
    usage,
  };
};
