import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: {
    create: vi.fn(),
  },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { personaSaveTool } = await import("./persona-save-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;

const validInput = {
  category: "意見",
  content: "村民は地元産の野菜を好む",
};

describe("personaSaveTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: persona を作成して success を返す", async () => {
    vi.mocked(personaRepository.create).mockResolvedValue("mock-id");

    const result = await callTool(personaSaveTool, validInput, { db: fakeDb });

    expect(result.success).toBe(true);
    expect(result.personaId).toBeDefined();
    expect(personaRepository.create).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        category: "意見",
        content: "村民は地元産の野菜を好む",
      }),
    );
  });

  it("entities 未指定でも空配列で create に渡す（未処理 NULL と区別）", async () => {
    vi.mocked(personaRepository.create).mockResolvedValue("mock-id");

    await callTool(personaSaveTool, validInput, { db: fakeDb });

    const arg = vi.mocked(personaRepository.create).mock.calls[0]?.[1];
    expect(arg?.entities).toBe("[]");
  });

  it("entities を JSON 文字列にして create に渡す", async () => {
    vi.mocked(personaRepository.create).mockResolvedValue("mock-id");

    await callTool(
      personaSaveTool,
      { ...validInput, entities: [{ name: "音威子府駅", type: "facility" }] },
      { db: fakeDb },
    );

    const arg = vi.mocked(personaRepository.create).mock.calls[0]?.[1];
    expect(arg?.entities).toBe(
      JSON.stringify([{ name: "音威子府駅", type: "facility" }]),
    );
  });

  it("conversationEndedAt があれば create に渡す", async () => {
    vi.mocked(personaRepository.create).mockResolvedValue("mock-id");

    await callTool(personaSaveTool, validInput, {
      db: fakeDb,
      conversationEndedAt: "2025-06-01T00:00:00Z",
    });

    const arg = vi.mocked(personaRepository.create).mock.calls[0]?.[1];
    expect(arg?.conversationEndedAt).toBe("2025-06-01T00:00:00Z");
  });

  it("DB なしは DB_NOT_AVAILABLE を返す", async () => {
    const result = await callTool(personaSaveTool, validInput, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB_NOT_AVAILABLE");
    expect(personaRepository.create).not.toHaveBeenCalled();
  });

  it("create が throw すると success: false + error を返す", async () => {
    vi.mocked(personaRepository.create).mockRejectedValue(
      new Error("DB write error"),
    );

    const result = await callTool(personaSaveTool, validInput, { db: fakeDb });

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB write error");
  });
});
