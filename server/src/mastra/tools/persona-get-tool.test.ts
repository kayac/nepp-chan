import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: {
    search: vi.fn(),
  },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { personaGetTool } = await import("./persona-get-tool");

import { buildToolContext } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };

const buildAdminCtx = (overrides: Record<string, unknown> = {}) =>
  buildToolContext({ db: fakeDb, adminUser, ...overrides });

const samplePersona = {
  id: "p-1",
  resourceId: "v-1",
  category: "意見",
  tags: null,
  content: "x",
  source: null,
  topic: null,
  sentiment: null,
  demographicSummary: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  conversationEndedAt: null,
};

describe("personaGetTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 結果を返す", async () => {
    vi.mocked(personaRepository.search).mockResolvedValue([samplePersona]);

    const result: any = await personaGetTool.execute!(
      { resourceId: "v-1", limit: 20 },
      buildAdminCtx(),
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.personas[0]).toMatchObject({
      id: "p-1",
      resourceId: "v-1",
      category: "意見",
      content: "x",
    });
  });

  it("ヒット 0 件は専用メッセージ", async () => {
    vi.mocked(personaRepository.search).mockResolvedValue([]);

    const result: any = await personaGetTool.execute!(
      { resourceId: "v-1", limit: 20 },
      buildAdminCtx(),
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/見つかりません/);
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result: any = await personaGetTool.execute!(
      { resourceId: "v-1", limit: 20 },
      buildToolContext({ db: fakeDb }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
    expect(personaRepository.search).not.toHaveBeenCalled();
  });

  it("staff ロールも NOT_AUTHORIZED（admin 以上必須）", async () => {
    const result: any = await personaGetTool.execute!(
      { resourceId: "v-1", limit: 20 },
      buildToolContext({
        db: fakeDb,
        adminUser: { id: "u-2", role: "staff" },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });

  it("search が throw すると success: false", async () => {
    vi.mocked(personaRepository.search).mockRejectedValue(new Error("db"));

    const result: any = await personaGetTool.execute!(
      { resourceId: "v-1", limit: 20 },
      buildAdminCtx(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("db");
  });
});
