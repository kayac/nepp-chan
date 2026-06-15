import { eq } from "drizzle-orm";
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

const { backfillPersonaEntities } = await import("./backfill-persona-entities");

const env = { DB: {} as D1Database } as CloudflareBindings;

const insertPersona = async (
  db: TestDb,
  params: { id: string; content?: string; entities?: string | null },
) => {
  await db.insert(persona).values({
    id: params.id,
    category: "意見",
    content: params.content ?? "音威子府駅について",
    entities: params.entities ?? null,
    createdAt: "2026-06-09T00:00:00.000Z",
  });
};

const mockEntities = (entities: { name: string; type: string }[]) => {
  generateMock.mockResolvedValue({
    object: { entities },
    totalUsage: { totalTokens: 1 },
  });
};

describe("backfillPersonaEntities", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    generateMock.mockReset();
  });

  it("entities 未処理の persona に抽出結果を書き込む", async () => {
    await insertPersona(db, { id: "p1" });
    mockEntities([{ name: "音威子府駅", type: "facility" }]);

    const result = await backfillPersonaEntities(env);

    expect(result).toEqual({ processed: 1, updated: 1, remaining: 0 });
    const row = await db
      .select({ entities: persona.entities })
      .from(persona)
      .where(eq(persona.id, "p1"))
      .get();
    expect(JSON.parse(row?.entities ?? "null")).toEqual([
      { name: "音威子府駅", type: "facility" },
    ]);
  });

  it("実体なしは空配列を書き込み再処理対象から外す", async () => {
    await insertPersona(db, { id: "p1" });
    mockEntities([]);

    const result = await backfillPersonaEntities(env);

    expect(result).toEqual({ processed: 1, updated: 0, remaining: 0 });
    const row = await db
      .select({ entities: persona.entities })
      .from(persona)
      .where(eq(persona.id, "p1"))
      .get();
    expect(row?.entities).toBe("[]");
  });

  it("処理済み（entities 非 NULL）は対象にしない", async () => {
    await insertPersona(db, { id: "done", entities: "[]" });
    mockEntities([{ name: "x", type: "facility" }]);

    const result = await backfillPersonaEntities(env);

    expect(result.processed).toBe(0);
    expect(generateMock).not.toHaveBeenCalled();
  });
});
