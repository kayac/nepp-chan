import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: { listForAudience: vi.fn() },
}));
vi.mock("~/repository/persona-tag-group-repository", () => ({
  personaTagGroupRepository: { listGroups: vi.fn(), listAliases: vi.fn() },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { personaTagGroupRepository } = await import(
  "~/repository/persona-tag-group-repository"
);
const { personaAudienceTool } = await import("./persona-audience-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;
const staffValues = { db: fakeDb, adminUser: { id: "u-1", role: "staff" } };

const group = (id: string, name: string, axis: string, sortOrder: number) => ({
  id,
  name,
  kind: "attribute",
  axis,
  sortOrder,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
});
const alias = (tag: string, groupId: string) => ({
  tag,
  groupId,
  assignedBy: "seed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
});
const row = (tags: string, content: string) => ({
  tags,
  demographicSummary: null,
  topic: "観光",
  sentiment: "neutral",
  entities: null,
  content,
  conversationEndedAt: "2026-06-01T00:00:00.000Z",
});

describe("personaAudienceTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(personaTagGroupRepository.listGroups).mockResolvedValue([
      group("soba-lover", "そば好き", "趣味層", 430),
      group("resident", "村内住民", "関わり", 40),
      group("outsider", "村外", "関わり", 50),
    ]);
    vi.mocked(personaTagGroupRepository.listAliases).mockResolvedValue([
      alias("そば好き", "soba-lover"),
      alias("村内", "resident"),
      alias("村外", "outsider"),
    ]);
    vi.mocked(personaRepository.listForAudience).mockResolvedValue([
      row("そば好き,村内", "打ちたてが好き"),
      row("そば好き,村外", "駅そばを食べに来た"),
      row("そば好き,村外", "年に一度は来る"),
      row("村内", "除雪が大変"),
    ]);
  });

  it("層を名前で指定すると他の軸での内訳を返す", async () => {
    const result = await callTool(
      personaAudienceTool,
      { group: "そば好き" },
      staffValues,
    );

    expect(result.success).toBe(true);
    expect(result.group.count).toBe(3);
    expect(result.group.breakdown).toEqual([
      {
        axis: "関わり",
        groups: [
          { name: "村外", count: 2 },
          { name: "村内住民", count: 1 },
        ],
      },
    ]);
  });

  it("層を省略すると全層の一覧を返す", async () => {
    const result = await callTool(personaAudienceTool, {}, staffValues);

    expect(result.success).toBe(true);
    expect(result.axes.map((a: { axis: string }) => a.axis)).toEqual([
      "関わり",
      "趣味層",
    ]);
  });

  it("無い層を指定すると使える層の名前を返す", async () => {
    const result = await callTool(
      personaAudienceTool,
      { group: "宇宙人" },
      staffValues,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("そば好き");
  });

  it("管理者でなければ使えない", async () => {
    const result = await callTool(personaAudienceTool, {}, { db: fakeDb });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });
});
