import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { personaCases } from "./cases";
import { loadDevVars, serverRoot } from "./dev-vars";
import { JUDGE_MODEL_ID, judgeUsage } from "./judges";
import { type CaseOutcome, evaluateCase } from "./runner";
import { costUsd, formatCost, formatUsd, sumUsage } from "./usage";

const { values } = parseArgs({
  options: {
    case: { type: "string" },
    platform: { type: "string" },
    n: { type: "string", default: "1" },
    "only-code": { type: "boolean", default: false },
    concurrency: { type: "string", default: "3" },
    out: {
      type: "string",
      default: resolve(serverRoot, "../eval-results/neppchan"),
    },
  },
});

const runPool = async <T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item !== undefined) await fn(item);
      }
    }),
  );
};

const positiveInt = (name: string, raw: string) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`--${name} は 1 以上の整数で指定する: ${raw}`);
  return n;
};

const main = async () => {
  loadDevVars();
  const n = positiveInt("n", values.n);
  const concurrency = positiveInt("concurrency", values.concurrency);
  const ids = values.case?.split(",");
  const unknown = ids?.filter((id) => !personaCases.some((c) => c.id === id));
  if (unknown?.length)
    throw new Error(`存在しないケース: ${unknown.join(",")}`);
  const selected = personaCases.filter(
    (c) =>
      (!ids || ids.includes(c.id)) &&
      (values.platform
        ? c.platform === values.platform
        : c.platform !== "voice"),
  );
  if (selected.length === 0) throw new Error("実行対象のケースがない");
  const jobs = selected.flatMap((c) =>
    Array.from({ length: n }, (_, i) => ({ c, i: i + 1 })),
  );
  const outcomes: CaseOutcome[] = [];

  console.log(
    `neppchan eval: ${selected.length} cases × n=${n}${values["only-code"] ? " (code graders only)" : ""}${values.platform ? "" : " (voice は未運用のため --platform voice 指定時のみ)"}`,
  );
  await runPool(jobs, concurrency, async ({ c, i }) => {
    const o = await evaluateCase(c, i, values["only-code"]);
    outcomes.push(o);
    const failed = o.gates
      .filter((g) => !g.passed)
      .map((g) => `${g.id}${g.reason ? `（${g.reason}）` : ""}`);
    console.log(
      `${o.passed ? "PASS" : "FAIL"} ${o.id}#${i} ${Math.round(o.ms / 1000)}s${o.error ? ` error: ${o.error}` : ""}${failed.length ? `\n     ✗ ${failed.join("\n     ✗ ")}` : ""}`,
    );
  });

  const byCase = new Map<string, CaseOutcome[]>();
  for (const o of outcomes) byCase.set(o.id, [...(byCase.get(o.id) ?? []), o]);
  const passRate =
    outcomes.filter((o) => o.passed).length / Math.max(outcomes.length, 1);
  const passAll = [...byCase.values()].filter((os) =>
    os.every((o) => o.passed),
  ).length;
  console.log(
    `\npass rate ${(passRate * 100).toFixed(0)}% (${outcomes.filter((o) => o.passed).length}/${outcomes.length})` +
      (n > 1 ? ` / pass^${n} ${passAll}/${byCase.size} cases` : ""),
  );

  const gateFails = new Map<string, number>();
  for (const o of outcomes)
    for (const g of o.gates)
      if (!g.passed) gateFails.set(g.id, (gateFails.get(g.id) ?? 0) + 1);
  if (gateFails.size) {
    console.log("failed gates:");
    for (const [id, count] of [...gateFails].sort((a, b) => b[1] - a[1]))
      console.log(`  ${count}× ${id}`);
  }

  const targetModel = outcomes.find((o) => o.model)?.model ?? "";
  const targetUsage = sumUsage(outcomes.map((o) => o.usage));
  const cost = {
    target: {
      model: targetModel,
      ...targetUsage,
      usd: costUsd(targetModel, targetUsage),
    },
    judge: {
      model: JUDGE_MODEL_ID,
      ...judgeUsage,
      usd: costUsd(JUDGE_MODEL_ID, judgeUsage),
    },
  };
  console.log(
    `\ncost: ${formatUsd(cost.target.usd + cost.judge.usd)}\n  ${formatCost("target", targetModel, targetUsage)}\n  ${formatCost("judge ", JUDGE_MODEL_ID, judgeUsage)}`,
  );

  mkdirSync(values.out, { recursive: true });
  const file = join(
    values.out,
    `${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    file,
    JSON.stringify(
      { n, onlyCode: values["only-code"], cost, outcomes },
      null,
      2,
    ),
  );
  console.log(`saved: ${file}`);
  process.exit(passRate === 1 ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
