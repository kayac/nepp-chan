import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/emergency-repository", () => ({
  emergencyRepository: {
    findRecent: vi.fn(),
  },
}));

const { emergencyRepository } = await import(
  "~/repository/emergency-repository"
);
const { adminEmergencyTool } = await import("./admin-emergency-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };
const adminValues = { db: fakeDb, adminUser };

const sample = {
  id: "e-1",
  type: "x",
  description: null,
  location: null,
  reportedAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("adminEmergencyTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 件数 + reports を返す", async () => {
    vi.mocked(emergencyRepository.findRecent).mockResolvedValue([sample]);

    const result = await callTool(
      adminEmergencyTool,
      { days: 30, limit: 50 },
      adminValues,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(emergencyRepository.findRecent).toHaveBeenCalledWith(fakeDb, 30, 50);
  });

  it("ヒットゼロは専用メッセージ", async () => {
    vi.mocked(emergencyRepository.findRecent).mockResolvedValue([]);

    const result = await callTool(
      adminEmergencyTool,
      { days: 30, limit: 50 },
      adminValues,
    );

    expect(result.message).toMatch(/ありません/);
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result = await callTool(
      adminEmergencyTool,
      { days: 30, limit: 50 },
      { db: fakeDb },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });

  it("repository が throw したら success=false で error メッセージを返す", async () => {
    vi.mocked(emergencyRepository.findRecent).mockRejectedValueOnce(
      new Error("db down"),
    );

    const result = await callTool(
      adminEmergencyTool,
      { days: 30, limit: 50 },
      adminValues,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("db down");
    expect(result.reports).toEqual([]);
  });

  it("非 Error の throw は Unknown error として扱う", async () => {
    vi.mocked(emergencyRepository.findRecent).mockRejectedValueOnce("boom");

    const result = await callTool(
      adminEmergencyTool,
      { days: 30, limit: 50 },
      adminValues,
    );

    expect(result.error).toBe("Unknown error");
  });
});
