import type { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoryHolder } = vi.hoisted(() => ({
  memoryHolder: {
    getWorkingMemory: vi.fn(),
  },
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn().mockImplementation(function (this: object, opts: unknown) {
    Object.assign(this, { ...memoryHolder, opts });
  }),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn(async () => ({ id: "storage" })),
}));

vi.mock("~/schemas/persona-schema", () => ({
  personaSchema: { id: "persona-schema" },
}));

const { Memory } = await import("@mastra/memory");
const { getStorage } = await import("~/lib/storage");
const { getMemoryFromContext, getWorkingMemoryByThread } = await import(
  "./index"
);

const buildRequestContext = (initial: Record<string, unknown> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
    }),
  } as unknown as RequestContext;
};

beforeEach(() => {
  vi.mocked(Memory).mockClear();
  vi.mocked(getStorage).mockClear();
  memoryHolder.getWorkingMemory.mockReset();
});

describe("getMemoryFromContext", () => {
  it("cachedMemory が無ければ Memory を生成して set する", () => {
    const ctx = buildRequestContext({ storage: { id: "s" } });

    const memory = getMemoryFromContext(ctx);

    expect(Memory).toHaveBeenCalledTimes(1);
    expect(ctx.set).toHaveBeenCalledWith("cachedMemory", memory);
  });

  it("cachedMemory があれば再利用して Memory は生成しない", () => {
    const cached = { id: "cached-memory" };
    const ctx = buildRequestContext({ cachedMemory: cached });

    const result = getMemoryFromContext(ctx);

    expect(result).toBe(cached);
    expect(Memory).not.toHaveBeenCalled();
    expect(ctx.set).not.toHaveBeenCalled();
  });

  it("options を Memory に渡す", () => {
    const ctx = buildRequestContext({ storage: { id: "s" } });
    const options = { lastMessages: 10 };

    getMemoryFromContext(ctx, options);

    const call = vi.mocked(Memory).mock.calls[0]?.[0] as { options: unknown };
    expect(call.options).toBe(options);
  });
});

describe("getWorkingMemoryByThread", () => {
  it("Memory.getWorkingMemory の結果を返す", async () => {
    memoryHolder.getWorkingMemory.mockResolvedValueOnce({ name: "Alice" });

    const result = await getWorkingMemoryByThread(
      {} as D1Database,
      "thr-1",
      "res-1",
    );

    expect(result).toEqual({ name: "Alice" });
    expect(memoryHolder.getWorkingMemory).toHaveBeenCalledWith({
      threadId: "thr-1",
      resourceId: "res-1",
    });
  });
});
