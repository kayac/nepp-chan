import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/analytics/tag-group-assign", () => ({
  assignUnmappedTags: vi.fn(),
}));

const { assignUnmappedTags } = await import(
  "~/services/analytics/tag-group-assign"
);
const { handleTagGroupAssign } = await import("./tag-group-assign-handler");

const env = {} as CloudflareBindings;
const ctx = {} as ExecutionContext;
// biome-ignore lint/suspicious/noExplicitAny: テスト用
const event = { cron: "0 18 * * *", type: "scheduled" } as any;

describe("handleTagGroupAssign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1 バッチ分の振り分けを実行する", async () => {
    vi.mocked(assignUnmappedTags).mockResolvedValue({
      assigned: 1,
      unassigned: 0,
      remaining: 0,
    });

    await handleTagGroupAssign(event, env, ctx);

    expect(assignUnmappedTags).toHaveBeenCalledWith(env);
  });

  it("失敗しても例外を外に出さない", async () => {
    vi.mocked(assignUnmappedTags).mockRejectedValue(new Error("llm down"));

    await expect(
      handleTagGroupAssign(event, env, ctx),
    ).resolves.toBeUndefined();
  });
});
