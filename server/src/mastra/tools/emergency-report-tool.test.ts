import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/emergency-repository", () => ({
  emergencyRepository: {
    create: vi.fn(),
  },
}));

const { emergencyRepository } = await import(
  "~/repository/emergency-repository"
);
const { emergencyReportTool } = await import("./emergency-report-tool");

import { callTool } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const dbValues = { db: fakeDb };

describe("emergencyReportTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 報告を作って reportId を返す", async () => {
    vi.mocked(emergencyRepository.create).mockResolvedValue("mock-id");

    const result = await callTool(
      emergencyReportTool,
      { type: "野生動物目撃", description: "クマ", location: "○○地区" },
      dbValues,
    );

    expect(result.success).toBe(true);
    expect(result.reportId).toBeDefined();
    const arg = vi.mocked(emergencyRepository.create).mock.calls[0]?.[1];
    expect(arg).toMatchObject({
      type: "野生動物目撃",
      description: "クマ",
      location: "○○地区",
    });
    expect(typeof arg?.reportedAt).toBe("string");
  });

  it("description / location 省略でも作成可能", async () => {
    vi.mocked(emergencyRepository.create).mockResolvedValue("mock-id");

    const result = await callTool(
      emergencyReportTool,
      { type: "火災" },
      dbValues,
    );

    expect(result.success).toBe(true);
  });

  it("DB なしは DB_NOT_AVAILABLE", async () => {
    const result = await callTool(emergencyReportTool, { type: "x" }, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB_NOT_AVAILABLE");
  });

  it("create が throw すると success: false", async () => {
    vi.mocked(emergencyRepository.create).mockRejectedValue(new Error("db"));

    const result = await callTool(emergencyReportTool, { type: "x" }, dbValues);

    expect(result.success).toBe(false);
    expect(result.error).toBe("db");
  });
});
