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

const { getOntology, mergeEntitySnapshot } = await import("./ontology");

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
});

describe("mergeEntitySnapshot", () => {
  const base = {
    nodes: [
      {
        id: "top:観光",
        label: "観光",
        kind: "topic" as const,
        count: 5,
        role: "関心点" as const,
        roles: ["関心点" as const],
      },
    ],
    links: [
      {
        source: "seg:観光客",
        target: "top:観光",
        n: 5,
        kind: "seg-topic" as const,
      },
    ],
    meta: {
      personaTotal: 5,
      generatedAt: "2026-06-15T00:00:00.000Z",
      entityLayerStatus: "none" as const,
      note: "",
    },
  };

  it("スナップショットが無ければ base をそのまま返す", () => {
    const result = mergeEntitySnapshot(base, undefined);
    expect(result).toBe(base);
    expect(result.meta.entityLayerStatus).toBe("none");
  });

  it("スナップショットの entity を合流し ready にする", () => {
    const snapshot = {
      id: "latest",
      dataJson: JSON.stringify({
        entities: [
          {
            id: "ent:音威子府駅",
            label: "音威子府駅",
            kind: "entity",
            count: 3,
            role: "関心点",
            roles: ["関心点"],
          },
        ],
        links: [
          {
            source: "ent:音威子府駅",
            target: "top:観光",
            n: 3,
            kind: "topic-ent",
          },
        ],
      }),
      entityCount: 1,
      generatedAt: "2026-06-15T01:00:00.000Z",
      generatedBy: "admin-1",
    };

    const result = mergeEntitySnapshot(base, snapshot);

    expect(result.meta.entityLayerStatus).toBe("ready");
    expect(result.nodes.find((n) => n.id === "ent:音威子府駅")).toBeDefined();
    expect(result.links.find((l) => l.kind === "topic-ent")).toBeDefined();
  });
});
