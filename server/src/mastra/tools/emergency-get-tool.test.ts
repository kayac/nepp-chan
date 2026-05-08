import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/emergency-repository", () => ({
  emergencyRepository: {
    findRecent: vi.fn(),
  },
}));

const { emergencyRepository } = await import(
  "~/repository/emergency-repository"
);
const { emergencyGetTool } = await import("./emergency-get-tool");

import { buildToolContext } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };
const ctx = buildToolContext({ db: fakeDb, adminUser });

const sample = {
  id: "e-1",
  type: "x",
  description: null,
  location: null,
  reportedAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("emergencyGetTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 件数とリストを返す", async () => {
    vi.mocked(emergencyRepository.findRecent).mockResolvedValue([sample]);

    const result: any = await emergencyGetTool.execute!(
      { days: 7, limit: 20 },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(emergencyRepository.findRecent).toHaveBeenCalledWith(fakeDb, 7, 20);
  });

  it("ヒットゼロは専用メッセージ", async () => {
    vi.mocked(emergencyRepository.findRecent).mockResolvedValue([]);

    const result: any = await emergencyGetTool.execute!(
      { days: 7, limit: 20 },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/ありません/);
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result: any = await emergencyGetTool.execute!(
      { days: 7, limit: 20 },
      buildToolContext({ db: fakeDb }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });
});
