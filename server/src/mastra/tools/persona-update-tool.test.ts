import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { personaUpdateTool } = await import("./persona-update-tool");

import { buildToolContext } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const ctx = buildToolContext({ db: fakeDb });

const sampleRow = {
  id: "p-1",
  resourceId: "v-1",
  category: "意見",
  tags: null,
  content: "古い内容",
  source: null,
  topic: null,
  sentiment: null,
  demographicSummary: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  conversationEndedAt: null,
};

describe("personaUpdateTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 既存 persona を更新", async () => {
    vi.mocked(personaRepository.findById).mockResolvedValue(sampleRow);
    vi.mocked(personaRepository.update).mockResolvedValue();

    const result: any = await personaUpdateTool.execute!(
      { id: "p-1", content: "新しい内容" },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(personaRepository.update).toHaveBeenCalledWith(fakeDb, "p-1", {
      category: undefined,
      tags: undefined,
      content: "新しい内容",
      source: undefined,
    });
  });

  it("更新項目が 1 つも無いと NO_UPDATE_FIELDS", async () => {
    const result: any = await personaUpdateTool.execute!({ id: "p-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_UPDATE_FIELDS");
    expect(personaRepository.findById).not.toHaveBeenCalled();
  });

  it("存在しない id は NOT_FOUND", async () => {
    vi.mocked(personaRepository.findById).mockResolvedValue(null);

    const result: any = await personaUpdateTool.execute!(
      { id: "missing", content: "x" },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_FOUND");
    expect(personaRepository.update).not.toHaveBeenCalled();
  });

  it("DB なしは DB_NOT_AVAILABLE", async () => {
    const result: any = await personaUpdateTool.execute!(
      { id: "p-1", content: "x" },
      buildToolContext({}),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB_NOT_AVAILABLE");
  });
});
