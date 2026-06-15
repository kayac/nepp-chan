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

const { getOntology } = await import("./ontology");

const d1 = {} as D1Database;

const insertPersona = async (
  db: TestDb,
  params: {
    id: string;
    tags?: string;
    demographicSummary?: string;
    topic?: string;
    sentiment?: string;
    conversationEndedAt?: string;
    entities?: { name: string; type: string }[];
  },
) => {
  await db.insert(persona).values({
    id: params.id,
    category: "意見",
    content: "テスト",
    tags: params.tags,
    demographicSummary: params.demographicSummary,
    topic: params.topic,
    sentiment: params.sentiment ?? "neutral",
    entities: params.entities ? JSON.stringify(params.entities) : null,
    createdAt: "2026-06-09T00:00:00.000Z",
    conversationEndedAt: params.conversationEndedAt,
  });
};

describe("getOntology", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("セグメントノード・トピックノード・リンクを集計する", async () => {
    await insertPersona(db, { id: "p1", tags: "観光客", topic: "観光" });
    await insertPersona(db, { id: "p2", tags: "観光客", topic: "観光" });
    await insertPersona(db, { id: "p3", tags: "村人", topic: "生活" });

    const result = await getOntology(d1, {});

    expect(result.meta.personaTotal).toBe(3);
    expect(result.meta.entityLayerStatus).toBe("none");

    const kanko = result.nodes.find((n) => n.id === "seg:観光客");
    expect(kanko).toMatchObject({
      kind: "segment",
      count: 2,
      role: "セグメント",
    });

    const topic = result.nodes.find((n) => n.id === "top:観光");
    expect(topic).toMatchObject({ kind: "topic", count: 2 });
    expect(topic?.bySegment).toEqual({ 観光客: 2 });

    const link = result.links.find(
      (l) => l.source === "seg:観光客" && l.target === "top:観光",
    );
    expect(link).toMatchObject({ n: 2, kind: "seg-topic" });
  });

  it("関係性を居住地より優先してセグメントを割り当てる", async () => {
    await insertPersona(db, { id: "p1", tags: "村外,観光客" });

    const result = await getOntology(d1, {});

    expect(result.nodes.find((n) => n.id === "seg:観光客")?.count).toBe(1);
    expect(result.nodes.find((n) => n.id === "seg:村外")).toBeUndefined();
  });

  it("既知トピック以外は『その他』に集約する", async () => {
    await insertPersona(db, { id: "p1", topic: "未定義トピック" });

    const result = await getOntology(d1, {});

    expect(result.nodes.find((n) => n.id === "top:その他")?.count).toBe(1);
  });

  it("ポジ・ネガが両立するトピックを争点に分類する", async () => {
    for (let i = 0; i < 5; i++) {
      await insertPersona(db, {
        id: `pos${i}`,
        topic: "買い物",
        sentiment: "positive",
      });
    }
    for (let i = 0; i < 5; i++) {
      await insertPersona(db, {
        id: `neg${i}`,
        topic: "買い物",
        sentiment: "negative",
      });
    }

    const topic = (await getOntology(d1, {})).nodes.find(
      (n) => n.id === "top:買い物",
    );
    expect(topic?.roles).toContain("争点");
    expect(topic?.role).toBe("争点");
  });

  it("中立中心で偏りのないトピックは関心点になる", async () => {
    for (let i = 0; i < 5; i++) {
      await insertPersona(db, {
        id: `n${i}`,
        topic: "観光",
        sentiment: "neutral",
      });
    }

    const topic = (await getOntology(d1, {})).nodes.find(
      (n) => n.id === "top:観光",
    );
    expect(topic?.roles).toEqual(["関心点"]);
  });

  it("複数セグメントから言及されるトピックを接続点にする", async () => {
    await insertPersona(db, { id: "p1", tags: "観光客", topic: "交通" });
    await insertPersona(db, { id: "p2", tags: "村人", topic: "交通" });

    const topic = (await getOntology(d1, {})).nodes.find(
      (n) => n.id === "top:交通",
    );
    expect(topic?.roles).toContain("接続点");
  });

  it("conversationEndedAt で期間を絞り込む", async () => {
    await insertPersona(db, {
      id: "in",
      topic: "観光",
      conversationEndedAt: "2026-06-10T00:00:00.000Z",
    });
    await insertPersona(db, {
      id: "out",
      topic: "観光",
      conversationEndedAt: "2026-05-01T00:00:00.000Z",
    });

    const result = await getOntology(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-07-01T00:00:00.000Z",
    });

    expect(result.meta.personaTotal).toBe(1);
  });

  it("persona.entities を集計してエンティティノード・リンクを作る", async () => {
    const eki = [{ name: "音威子府駅", type: "facility" }];
    await insertPersona(db, {
      id: "p1",
      tags: "観光客",
      topic: "観光",
      entities: eki,
    });
    await insertPersona(db, {
      id: "p2",
      tags: "村人",
      topic: "交通",
      entities: eki,
    });
    await insertPersona(db, {
      id: "p3",
      tags: "観光客",
      topic: "観光",
      entities: [{ name: " 音威子府駅", type: "facility" }],
    });

    const result = await getOntology(d1, {});

    expect(result.meta.entityLayerStatus).toBe("ready");
    const ent = result.nodes.find((n) => n.id === "ent:音威子府駅");
    expect(ent).toMatchObject({ kind: "entity", count: 3, type: "facility" });
    expect(result.links.some((l) => l.kind === "topic-ent")).toBe(true);
    expect(result.links.some((l) => l.kind === "seg-ent")).toBe(true);
  });

  it("出現回数が閾値未満のエンティティは除外する", async () => {
    const michi = [{ name: "道の駅", type: "facility" }];
    await insertPersona(db, { id: "p1", topic: "観光", entities: michi });
    await insertPersona(db, { id: "p2", topic: "観光", entities: michi });

    const result = await getOntology(d1, {});

    expect(result.nodes.find((n) => n.id === "ent:道の駅")).toBeUndefined();
    expect(result.meta.entityLayerStatus).toBe("none");
  });

  it("entities 未処理の persona が残る間は stale を返す", async () => {
    const eki = [{ name: "音威子府駅", type: "facility" }];
    for (const id of ["p1", "p2", "p3"]) {
      await insertPersona(db, { id, topic: "観光", entities: eki });
    }
    // entities 未処理（NULL）の persona を残す
    await insertPersona(db, { id: "pending", topic: "観光" });

    const result = await getOntology(d1, {});

    expect(result.nodes.find((n) => n.id === "ent:音威子府駅")).toBeDefined();
    expect(result.meta.entityLayerStatus).toBe("stale");
  });
});
