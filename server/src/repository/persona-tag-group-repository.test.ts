import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { personaTagGroups } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return { ...actual, createDb: () => testDbHolder.db };
});

const { personaTagGroupRepository } = await import(
  "./persona-tag-group-repository"
);

const d1 = {} as D1Database;

describe("personaTagGroupRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    await db.insert(personaTagGroups).values([
      {
        id: "resident",
        name: "村内住民",
        kind: "attribute",
        axis: "関わり",
        sortOrder: 40,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "tourist",
        name: "観光客",
        kind: "attribute",
        axis: "関わり",
        sortOrder: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("グループを sortOrder 順に返す", async () => {
    const groups = await personaTagGroupRepository.listGroups(d1);
    expect(groups.map((g) => g.id)).toEqual(["tourist", "resident"]);
  });

  it("insertAliasesIfAbsent は既存タグを上書きしない", async () => {
    await personaTagGroupRepository.insertAliasesIfAbsent(d1, [
      { tag: "旅行者", groupId: "tourist", assignedBy: "llm" },
    ]);
    await personaTagGroupRepository.insertAliasesIfAbsent(d1, [
      { tag: "旅行者", groupId: "resident", assignedBy: "llm" },
      { tag: "謎", groupId: null, assignedBy: "llm" },
    ]);

    const aliases = await personaTagGroupRepository.listAliases(d1);
    expect(aliases.find((a) => a.tag === "旅行者")?.groupId).toBe("tourist");
    expect(aliases.find((a) => a.tag === "謎")?.groupId).toBeNull();
  });

  it("setAlias は割り当て先を上書きし、更新者を記録する", async () => {
    await personaTagGroupRepository.insertAliasesIfAbsent(d1, [
      { tag: "旅行者", groupId: null, assignedBy: "llm" },
    ]);
    await personaTagGroupRepository.setAlias(d1, {
      tag: "旅行者",
      groupId: "tourist",
      assignedBy: "human",
    });

    const alias = (await personaTagGroupRepository.listAliases(d1))[0];
    expect(alias).toMatchObject({
      tag: "旅行者",
      groupId: "tourist",
      assignedBy: "human",
    });
    expect(alias?.updatedAt).not.toBeNull();
  });

  it("createGroup は行を作って返す", async () => {
    const created = await personaTagGroupRepository.createGroup(d1, {
      id: "farmers",
      name: "農家",
      kind: "attribute",
      axis: "立場",
      sortOrder: 360,
    });

    expect(created).toMatchObject({
      id: "farmers",
      name: "農家",
      axis: "立場",
    });
    expect(
      (await personaTagGroupRepository.listGroups(d1)).map((g) => g.id),
    ).toEqual(["tourist", "resident", "farmers"]);
  });

  it("findGroup は無ければ null", async () => {
    expect(
      await personaTagGroupRepository.findGroup(d1, "tourist"),
    ).not.toBeNull();
    expect(await personaTagGroupRepository.findGroup(d1, "nope")).toBeNull();
  });
});
