import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Snapshot = {
  id: string;
  capturedAt: string;
  source: string;
  turns: { user: string; assistant: string; tools: string[] }[];
};

const dir = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

export const snapshotFor = (id: string): Snapshot | undefined => {
  const file = join(dir, `${id}.json`);
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as Snapshot;
};

export const snapshotAnswer = (id: string) =>
  snapshotFor(id)?.turns.at(-1)?.assistant;
