import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { persona } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("~/mastra/agents/ontology-entity-agent", () => ({
  ontologyEntityAgent: { generate: generateMock },
}));

const { runOntologyEntities } = await import("./ontology-entities");
const { ontologySnapshotRepository } = await import(
  "~/repository/ontology-snapshot-repository"
);

const env = { DB: {} as D1Database } as CloudflareBindings;

const insertPersona = async (
  db: TestDb,
  params: { id: string; tags?: string; topic?: string; sentiment?: string },
) => {
  await db.insert(persona).values({
    id: params.id,
    category: "意見",
    content: "テスト",
    tags: params.tags,
    topic: params.topic,
    sentiment: params.sentiment ?? "neutral",
    createdAt: "2026-06-09T00:00:00.000Z",
  });
};

// 各 voice index にエンティティ名を割り当てた structured output を返す
const mockExtraction = (namesByIndex: string[]) => {
  generateMock.mockResolvedValue({
    object: {
      voices: namesByIndex.map((name, index) => ({
        index,
        entities: [{ name, type: "facility" }],
      })),
    },
    totalUsage: { totalTokens: 1 },
  });
};

const loadSnapshot = async (db: TestDb) => {
  const snapshot = await ontologySnapshotRepository.getLatest(db as never);
  if (!snapshot) throw new Error("snapshot not found");
  return JSON.parse(snapshot.dataJson) as {
    entities: { id: string; label: string; count: number }[];
    links: { source: string; target: string; kind: string }[];
  };
};

describe("runOntologyEntities", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    generateMock.mockReset();
  });

  it("同一エンティティを集計してスナップショットに保存する", async () => {
    await insertPersona(db, { id: "p1", tags: "観光客", topic: "観光" });
    await insertPersona(db, { id: "p2", tags: "観光客", topic: "観光" });
    await insertPersona(db, { id: "p3", tags: "村人", topic: "観光" });
    mockExtraction(["音威子府駅", "音威子府駅", "音威子府駅"]);

    const result = await runOntologyEntities(env, { generatedBy: "admin-1" });

    expect(result.entityCount).toBe(1);
    const { entities, links } = await loadSnapshot(db);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ label: "音威子府駅", count: 3 });
    expect(
      links.find(
        (l) => l.source === "ent:音威子府駅" && l.target === "top:観光",
      ),
    ).toMatchObject({ kind: "topic-ent" });
    expect(links.some((l) => l.kind === "seg-ent")).toBe(true);
  });

  it("表記揺れ（空白）を正規化して 1 件にマージする", async () => {
    await insertPersona(db, { id: "p1", topic: "観光" });
    await insertPersona(db, { id: "p2", topic: "観光" });
    await insertPersona(db, { id: "p3", topic: "観光" });
    mockExtraction([" 音威子府駅", "音威子府駅 ", "音威子府駅"]);

    const result = await runOntologyEntities(env, { generatedBy: "admin-1" });

    expect(result.entityCount).toBe(1);
    const { entities } = await loadSnapshot(db);
    expect(entities[0].count).toBe(3);
  });

  it("出現回数が閾値未満のエンティティは除外する", async () => {
    await insertPersona(db, { id: "p1", topic: "観光" });
    await insertPersona(db, { id: "p2", topic: "観光" });
    mockExtraction(["道の駅", "道の駅"]);

    const result = await runOntologyEntities(env, { generatedBy: "admin-1" });

    expect(result.entityCount).toBe(0);
    const { entities } = await loadSnapshot(db);
    expect(entities).toHaveLength(0);
  });

  it("generatedBy を記録する", async () => {
    await insertPersona(db, { id: "p1", topic: "観光" });
    mockExtraction(["道の駅"]);

    await runOntologyEntities(env, { generatedBy: "admin-9" });

    const snapshot = await ontologySnapshotRepository.getLatest(db as never);
    expect(snapshot?.generatedBy).toBe("admin-9");
  });
});
