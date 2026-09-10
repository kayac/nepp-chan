import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { personaCases } from "./cases";
import type { PersonaCase } from "./schema";
import { parseChatStream } from "./sse";

const API = "https://api.nepp-chan.ai";
const here = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(here, "snapshots");

const { values } = parseArgs({
  options: {
    case: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`${res.status} ${res.url} ${await res.text()}`);
  return res.json() as Promise<Record<string, string>>;
};

const looksDegenerate = (text: string) => {
  for (let i = 0; i + 20 <= text.length; i += 10) {
    if (text.split(text.slice(i, i + 20)).length > 4) return true;
  }
  return false;
};

const captureSane = async (c: PersonaCase) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const turns = await capture(c);
    const last = turns.at(-1)?.assistant ?? "";
    if (!looksDegenerate(last)) return turns;
    console.warn(`retry ${c.id}: 応答が繰り返しに崩れた（${attempt}/3）`);
  }
  throw new Error("3 回とも応答が崩れた");
};

const capture = async (c: PersonaCase) => {
  const { token } = await json(
    await fetch(`${API}/auth/anonymous-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const thread = await json(
    await fetch(`${API}/threads`, { method: "POST", headers, body: "{}" }),
  );
  const turns: { user: string; assistant: string; tools: string[] }[] = [];
  for (const text of c.turns) {
    const res = await fetch(`${API}/threads/${thread.id}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text }],
        },
        ...(c.intent ? { intent: c.intent } : {}),
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok)
      throw new Error(`${res.status} ${res.url} ${await res.text()}`);
    const parsed = parseChatStream(await res.text());
    turns.push({ user: text, assistant: parsed.text, tools: parsed.tools });
  }
  return turns;
};

const main = async () => {
  const ids = values.case?.split(",");
  const targets = personaCases.filter(
    (c) => c.platform === "web" && (!ids || ids.includes(c.id)),
  );
  mkdirSync(snapshotDir, { recursive: true });
  let failed = 0;
  for (const c of targets) {
    const file = join(snapshotDir, `${c.id}.json`);
    if (existsSync(file) && !values.force) {
      console.log(`skip ${c.id} (既存。上書きは --force)`);
      continue;
    }
    try {
      const turns = await captureSane(c);
      writeFileSync(
        file,
        `${JSON.stringify(
          {
            id: c.id,
            capturedAt: new Date().toISOString().slice(0, 10),
            source: "web gemini",
            turns,
          },
          null,
          2,
        )}\n`,
      );
      console.log(
        `saved ${c.id} (${turns.at(-1)?.assistant.length ?? 0} chars)`,
      );
    } catch (e) {
      failed++;
      console.error(`FAILED ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (failed) process.exitCode = 1;
};

main();
