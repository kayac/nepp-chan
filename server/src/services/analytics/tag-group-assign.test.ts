import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedRelationGroups } from "~/__tests__/helpers/tag-groups";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { persona } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return { ...actual, createDb: () => testDbHolder.db };
});

vi.mock("~/lib/storage", () => ({ getStorage: vi.fn().mockResolvedValue({}) }));

const { assignUnmappedTags, createTagGroup, getTagGroupOverview } =
  await import("./tag-group-assign");
const { personaTagGroupRepository } = await import(
  "~/repository/persona-tag-group-repository"
);

const env = { DB: {} as D1Database } as CloudflareBindings;

const insertPersona = async (db: TestDb, id: string, tags: string) => {
  await db.insert(persona).values({
    id,
    category: "意見",
    content: `声 ${id}`,
    tags,
    sentiment: "neutral",
    createdAt: "2026-06-09T00:00:00.000Z",
  });
};

const classifierReturning = (assignments: unknown) => ({
  generate: vi.fn().mockResolvedValue({ object: { assignments } }),
});

describe("assignUnmappedTags", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    await seedRelationGroups(db);
  });

  it("未登録タグだけを LLM に渡し、結果を別名表に登録する", async () => {
    await insertPersona(db, "p1", "観光客,旅行検討者");
    await insertPersona(db, "p2", "旅行検討者,謎");
    const classifier = classifierReturning([
      { tag: "旅行検討者", groupId: "tourist" },
      { tag: "謎", groupId: null },
    ]);

    const result = await assignUnmappedTags(env, { classifier });

    const prompt = classifier.generate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("旅行検討者（2）");
    expect(prompt).not.toContain("- 観光客（");
    expect(result).toEqual({ assigned: 1, unassigned: 1, remaining: 0 });

    const aliases = await personaTagGroupRepository.listAliases(env.DB);
    expect(aliases.find((a) => a.tag === "旅行検討者")).toMatchObject({
      groupId: "tourist",
      assignedBy: "llm",
    });
    expect(aliases.find((a) => a.tag === "謎")?.groupId).toBeNull();
  });

  it("LLM が返さなかったタグも未分類として登録し、次回は送らない", async () => {
    await insertPersona(db, "p1", "返答なし");
    const classifier = classifierReturning([]);

    await assignUnmappedTags(env, { classifier });
    const second = await assignUnmappedTags(env, { classifier });

    expect(classifier.generate).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ assigned: 0, unassigned: 0, remaining: 0 });
  });

  it("未登録タグが無ければ LLM を呼ばない", async () => {
    await insertPersona(db, "p1", "観光客");
    const classifier = classifierReturning([]);

    const result = await assignUnmappedTags(env, { classifier });

    expect(classifier.generate).not.toHaveBeenCalled();
    expect(result).toEqual({ assigned: 0, unassigned: 0, remaining: 0 });
  });
});

describe("getTagGroupOverview", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    await seedRelationGroups(db);
  });

  it("グループごとの所属タグを出現件数つきで返し、未分類は登録有無を問わず件数順に返す", async () => {
    await insertPersona(db, "p1", "観光客,旅行者,新語");
    await insertPersona(db, "p2", "観光客,新語,謎");
    await personaTagGroupRepository.insertAliasesIfAbsent(env.DB, [
      { tag: "謎", groupId: null, assignedBy: "llm" },
    ]);

    const overview = await getTagGroupOverview(env.DB);

    const tourist = overview.groups.find((g) => g.id === "tourist");
    expect(tourist?.tags.slice(0, 2)).toEqual([
      { tag: "観光客", assignedBy: "seed", count: 2 },
      { tag: "旅行者", assignedBy: "seed", count: 1 },
    ]);
    expect(overview.unassigned).toEqual([
      { tag: "新語", count: 2, example: "声 p1" },
      { tag: "謎", count: 1, example: "声 p2" },
    ]);
  });

  it("最近 LLM が振り分けたタグを新しい順に返し、人が付けたものは含めない", async () => {
    await personaTagGroupRepository.insertAliasesIfAbsent(env.DB, [
      { tag: "旅行客", groupId: "tourist", assignedBy: "llm" },
      { tag: "住民", groupId: "resident", assignedBy: "human" },
    ]);

    const overview = await getTagGroupOverview(env.DB);

    expect(overview.recent).toEqual([
      expect.objectContaining({
        tag: "旅行客",
        groupId: "tourist",
        groupName: "観光客",
      }),
    ]);
  });
});

describe("createTagGroup", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    await seedRelationGroups(db);
  });

  it("末尾の sortOrder の後ろに追加し、属性以外は軸を持たない", async () => {
    const attribute = await createTagGroup(env.DB, {
      name: "農家",
      kind: "attribute",
      axis: "立場",
    });
    const topic = await createTagGroup(env.DB, {
      name: "農業",
      kind: "topic",
      axis: "立場",
    });

    expect(attribute).toMatchObject({
      name: "農家",
      axis: "立場",
      sortOrder: 170,
    });
    expect(topic).toMatchObject({ name: "農業", axis: null, sortOrder: 180 });
  });
});
