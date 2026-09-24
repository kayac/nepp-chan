import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { latestAssistantText } = await import("./thread-history");

const message = (
  role: "user" | "assistant" | "system",
  parts: Array<Record<string, unknown>>,
) => ({
  id: crypto.randomUUID(),
  role,
  threadId: "thr-1",
  createdAt: new Date(),
  content: { format: 2 as const, parts },
});

const storageWith = (messages: unknown[] | Error, memoryStore = true) =>
  ({
    getStore: vi.fn(async () =>
      memoryStore
        ? {
            listMessages: vi.fn(async () => {
              if (messages instanceof Error) throw messages;
              return { messages };
            }),
          }
        : undefined,
    ),
    // biome-ignore lint/suspicious/noExplicitAny: D1Store の必要メソッドだけ模した stub
  }) as any;

describe("latestAssistantText", () => {
  it("最新の assistant メッセージの text パートを結合して返す", async () => {
    const storage = storageWith([
      message("user", [{ type: "text", text: "村内で！" }]),
      message("assistant", [
        { type: "text", text: "お蕎麦いいね！" },
        { type: "tool-invocation", toolInvocation: {} },
        { type: "text", text: "村内で食べたい？" },
      ]),
      message("assistant", [{ type: "text", text: "古い返答" }]),
    ]);
    expect(await latestAssistantText(storage, "thr-1")).toBe(
      "お蕎麦いいね！村内で食べたい？",
    );
  });

  it("threadId を渡し createdAt 降順で取得する", async () => {
    const storage = storageWith([]);
    await latestAssistantText(storage, "thr-1");
    const memoryStore = await storage.getStore.mock.results[0]?.value;
    expect(memoryStore.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thr-1",
        orderBy: { field: "createdAt", direction: "DESC" },
      }),
    );
  });

  it("assistant メッセージが無ければ undefined", async () => {
    const storage = storageWith([
      message("user", [{ type: "text", text: "こんにちは" }]),
      message("system", [{ type: "text", text: "お知らせ" }]),
    ]);
    expect(await latestAssistantText(storage, "thr-1")).toBeUndefined();
  });

  it("assistant に text パートが無ければ undefined", async () => {
    const storage = storageWith([
      message("assistant", [{ type: "tool-invocation", toolInvocation: {} }]),
    ]);
    expect(await latestAssistantText(storage, "thr-1")).toBeUndefined();
  });

  it("memory ストアが無ければ undefined", async () => {
    expect(
      await latestAssistantText(storageWith([], false), "thr-1"),
    ).toBeUndefined();
  });

  it("取得が throw しても undefined を返す", async () => {
    expect(
      await latestAssistantText(storageWith(new Error("d1 down")), "thr-1"),
    ).toBeUndefined();
  });
});
