import { randomUUID } from "node:crypto";
import type { Agent, AgentExecutionOptions } from "@mastra/core/agent";
import {
  createScorer,
  runEvals,
  type ScorerRunOutputForAgent,
} from "@mastra/core/evals";
import type { Memory } from "@mastra/memory";
import { buildGateRun } from "./gate-run";
import { calledTools, finalResponseText } from "./graders";
import type { PersonaCase } from "./schema";
import { createEvalTarget } from "./target";

export { loadDevVars, serverRoot } from "./dev-vars";

export type GateOutcome = { id: string; passed: boolean; reason?: string };
export type CaseOutcome = {
  id: string;
  iteration: number;
  passed: boolean;
  gates: GateOutcome[];
  text: string;
  tools: string[];
  ms: number;
  error?: string;
};

type StepLike = { text?: string; toolCalls?: unknown[] };
type ToolCallLike = { payload?: { toolName?: string }; toolName?: string };

const toolName = (tc: unknown) => {
  const t = tc as ToolCallLike;
  return t.payload?.toolName ?? t.toolName;
};

const captureScorer = () => {
  let captured: ScorerRunOutputForAgent | undefined;
  const scorer = createScorer({
    id: "code:capture",
    description: "最終ターンの出力を gate 実行用に保持する",
    type: "agent",
  }).generateScore(({ run }) => {
    captured = run.output;
    return 1;
  });
  return { scorer, get: () => captured };
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

const isCodeGate = (id: string) =>
  id.startsWith("code:") || id.startsWith("check-");

export const evaluateCase = async (
  c: PersonaCase,
  iteration: number,
  onlyCode: boolean,
): Promise<CaseOutcome> => {
  const started = Date.now();
  const fail = (e: unknown): CaseOutcome => ({
    id: c.id,
    iteration,
    passed: false,
    gates: [],
    text: "",
    tools: [],
    ms: Date.now() - started,
    error: e instanceof Error ? e.message : String(e),
  });

  const gates = onlyCode ? c.gates.filter((g) => isCodeGate(g.id)) : c.gates;
  const capture = captureScorer();
  const last = c.turns.length - 1;
  let stepTexts: string[] = [];
  let stepTools: string[] = [];
  let output: ScorerRunOutputForAgent | undefined;
  try {
    const { agent, memory } = createEvalTarget(c);
    const resource = `eval-${c.id}-${randomUUID()}`;
    if (c.seed) seedOnFirstTurn(agent, memory, resource, c.seed);
    await runEvals({
      target: agent,
      scorers: [],
      data: [
        {
          turns: c.turns.map((input, i) =>
            i === last ? { input, scorers: [capture.scorer] } : { input },
          ),
        },
      ],
      targetOptions: { memory: { resource } },
      concurrency: 1,
      onItemComplete: async ({ targetResult }) => {
        const steps = ((await targetResult.steps) ?? []) as StepLike[];
        stepTexts = steps.map((s) => s.text?.trim() ?? "").filter(Boolean);
        stepTools = [
          ...new Set(
            steps
              .flatMap((s) => s.toolCalls ?? [])
              .map(toolName)
              .filter((n): n is string => Boolean(n)),
          ),
        ];
      },
    });
    output = capture.get();
    if (!output) throw new Error("最終ターンの出力を取得できなかった");
  } catch (e) {
    return fail(e);
  }

  const tools = [...new Set([...calledTools(output), ...stepTools])];
  const { run, text } = buildGateRun({
    turns: c.turns,
    stepTexts,
    finalText: finalResponseText(output),
    tools,
  });
  const gateOutcomes: GateOutcome[] = [];
  for (const gate of gates) {
    try {
      const r = await gate.run(run);
      gateOutcomes.push({
        id: gate.id,
        passed: r.score === 1,
        reason: r.reason,
      });
    } catch (e) {
      gateOutcomes.push({
        id: gate.id,
        passed: false,
        reason: `scorer error: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return {
    id: c.id,
    iteration,
    passed: gateOutcomes.every((g) => g.passed),
    gates: gateOutcomes,
    text,
    tools,
    ms: Date.now() - started,
  };
};
