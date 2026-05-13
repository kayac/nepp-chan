import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/emergency-repository", () => ({
  emergencyRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

const { emergencyRepository } = await import(
  "~/repository/emergency-repository"
);
const { emergencyUpdateTool } = await import("./emergency-update-tool");

import { callTool } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const dbValues = { db: fakeDb };

const sampleReport = {
  id: "e-1",
  type: "野生動物目撃",
  description: null,
  location: null,
  reportedAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("emergencyUpdateTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: description だけ更新", async () => {
    vi.mocked(emergencyRepository.findById).mockResolvedValue(sampleReport);
    vi.mocked(emergencyRepository.update).mockResolvedValue();

    const result = await callTool(
      emergencyUpdateTool,
      { reportId: "e-1", description: "詳細追加" },
      dbValues,
    );

    expect(result.success).toBe(true);
    expect(emergencyRepository.update).toHaveBeenCalledWith(fakeDb, "e-1", {
      description: "詳細追加",
      location: undefined,
    });
  });

  it("更新項目なしは NO_UPDATE_FIELDS", async () => {
    const result = await callTool(
      emergencyUpdateTool,
      { reportId: "e-1" },
      dbValues,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_UPDATE_FIELDS");
    expect(emergencyRepository.findById).not.toHaveBeenCalled();
  });

  it("存在しない reportId は REPORT_NOT_FOUND", async () => {
    vi.mocked(emergencyRepository.findById).mockResolvedValue(null);

    const result = await callTool(
      emergencyUpdateTool,
      { reportId: "missing", description: "x" },
      dbValues,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("REPORT_NOT_FOUND");
  });

  it("update が throw すると success: false", async () => {
    vi.mocked(emergencyRepository.findById).mockResolvedValue(sampleReport);
    vi.mocked(emergencyRepository.update).mockRejectedValue(new Error("db"));

    const result = await callTool(
      emergencyUpdateTool,
      { reportId: "e-1", description: "x" },
      dbValues,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("db");
  });

  it("非 Error の throw は Unknown error", async () => {
    vi.mocked(emergencyRepository.findById).mockResolvedValue(sampleReport);
    vi.mocked(emergencyRepository.update).mockRejectedValue("oops");

    const result = await callTool(
      emergencyUpdateTool,
      { reportId: "e-1", description: "x" },
      dbValues,
    );

    expect(result.error).toBe("Unknown error");
  });
});
