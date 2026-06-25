import { beforeEach, describe, expect, it, vi } from "vitest";
import { toVoiceIds } from "~/lib/principal";
import { runVoiceTurn, streamTextWithAbort } from "./conversation";

async function* fakeStream(items: string[]): AsyncGenerator<string> {
  for (const item of items) yield item;
}

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));
vi.mock("~/lib/classify-intent", () => ({
  classifyIntent: vi.fn().mockResolvedValue("casual"),
}));
vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(() => ({})),
}));
vi.mock("@mastra/core/mastra", () => ({
  Mastra: class {
    getAgent() {
      return { stream: streamMock };
    }
  },
}));

describe("streamTextWithAbort", () => {
  it("全 delta を順に yield する", async () => {
    const out: string[] = [];
    for await (const d of streamTextWithAbort(fakeStream(["a", "b", "c"]))) {
      out.push(d);
    }
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("空 delta はスキップする", async () => {
    const out: string[] = [];
    for await (const d of streamTextWithAbort(fakeStream(["a", "", "c"]))) {
      out.push(d);
    }
    expect(out).toEqual(["a", "c"]);
  });

  it("abort 後は yield を止める（barge-in）", async () => {
    const controller = new AbortController();
    const out: string[] = [];
    for await (const d of streamTextWithAbort(
      fakeStream(["a", "b", "c"]),
      controller.signal,
    )) {
      out.push(d);
      if (d === "a") controller.abort();
    }
    expect(out).toEqual(["a"]);
  });
});

describe("runVoiceTurn", () => {
  const env = {
    DB: {},
    RESOURCE_ID_HASH_SECRET: "test-secret",
  } as unknown as CloudflareBindings;

  beforeEach(() => {
    streamMock.mockReset();
  });

  it("toVoiceIds 由来の memory を渡して delta を順に yield する", async () => {
    streamMock.mockResolvedValue({
      textStream: fakeStream(["こん", "にちは"]),
    });

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:tester",
      text: "やあ",
    })) {
      out.push(d);
    }

    expect(out).toEqual(["こん", "にちは"]);
    const ids = await toVoiceIds("client:tester", "test-secret");
    expect(streamMock).toHaveBeenCalledWith(
      "やあ",
      expect.objectContaining({
        memory: { resource: ids.resourceId, thread: ids.threadId },
      }),
    );
  });

  it("delta から絵文字を除去して返す（TTS は絵文字を読めない）", async () => {
    streamMock.mockResolvedValue({
      textStream: fakeStream(["おはよう", "🌸", "いい天気だね😊"]),
    });

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:tester",
      text: "おはよう",
    })) {
      out.push(d);
    }

    expect(out).toEqual(["おはよう", "いい天気だね"]);
  });

  it("signal を agent.stream に渡し、中断で停止する", async () => {
    streamMock.mockResolvedValue({ textStream: fakeStream(["a", "b", "c"]) });
    const controller = new AbortController();

    const out: string[] = [];
    for await (const d of runVoiceTurn({
      env,
      from: "client:x",
      text: "hi",
      signal: controller.signal,
    })) {
      out.push(d);
      if (d === "a") controller.abort();
    }

    expect(out).toEqual(["a"]);
    expect(streamMock).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({ abortSignal: controller.signal }),
    );
  });
});
