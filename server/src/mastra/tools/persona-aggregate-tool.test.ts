import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: {
    aggregateByTopic: vi.fn(),
  },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { personaAggregateTool } = await import("./persona-aggregate-tool");

import { callTool } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };
const adminValues = { db: fakeDb, adminUser };

describe("personaAggregateTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空配列なら totalCount=0 のメッセージ", async () => {
    vi.mocked(personaRepository.aggregateByTopic).mockResolvedValue([]);

    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      adminValues,
    );

    expect(result.success).toBe(true);
    expect(result.totalCount).toBe(0);
    expect(result.aggregations).toEqual([]);
  });

  it("demographics を「項目(件数)」形式で集計", async () => {
    vi.mocked(personaRepository.aggregateByTopic).mockResolvedValue([
      {
        topic: "バス",
        category: "要望",
        count: 3,
        demographics: "60代,60代,村内",
        samples: "意見1 | 意見2 | 意見3 | 意見4",
      },
    ]);

    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      adminValues,
    );

    expect(result.aggregations[0].demographics).toBe("60代(2), 村内(1)");
  });

  it("samples は最大 3 件まで返す", async () => {
    vi.mocked(personaRepository.aggregateByTopic).mockResolvedValue([
      {
        topic: "x",
        category: "y",
        count: 5,
        demographics: "",
        samples: "a | b | c | d | e",
      },
    ]);

    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      adminValues,
    );

    expect(result.aggregations[0].samples).toEqual(["a", "b", "c"]);
  });

  it("demographics が null なら 不明", async () => {
    vi.mocked(personaRepository.aggregateByTopic).mockResolvedValue([
      {
        topic: "x",
        category: "y",
        count: 1,
        demographics: "",
        samples: "",
      },
    ]);

    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      adminValues,
    );

    expect(result.aggregations[0].demographics).toBe("不明");
    expect(result.aggregations[0].samples).toEqual([]);
  });

  it("totalCount は count の合計", async () => {
    vi.mocked(personaRepository.aggregateByTopic).mockResolvedValue([
      {
        topic: "a",
        category: "x",
        count: 3,
        demographics: "",
        samples: "",
      },
      {
        topic: "b",
        category: "x",
        count: 7,
        demographics: "",
        samples: "",
      },
    ]);

    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      adminValues,
    );

    expect(result.totalCount).toBe(10);
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result = await callTool(
      personaAggregateTool,
      { limit: 20 },
      { db: fakeDb },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });
});
