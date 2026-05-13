import { describe, expect, it } from "vitest";
import type { BroadcastMessage } from "~/types";
import { getImageUrl, type PartState, parseParts } from "./helpers";

const idGen = () => {
  let i = 0;
  return () => `id-${++i}`;
};

const baseBroadcast = (
  overrides: Partial<BroadcastMessage>,
): BroadcastMessage =>
  ({
    id: "b-1",
    title: "t",
    body: "本文",
    parts: null,
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    errorMessage: null,
    createdBy: "u",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: null,
    ...overrides,
  }) as BroadcastMessage;

describe("parseParts", () => {
  it("parts が null のときは body をテキストパート 1 件で返す", () => {
    const result = parseParts(baseBroadcast({ parts: null }), idGen());
    expect(result).toEqual([{ id: "id-1", type: "text", text: "本文" }]);
  });

  it("parts が JSON で複数パートを持つときは順序保持してパース", () => {
    const parts: PartState[] = [
      { id: "discarded", type: "text", text: "hi" },
      { id: "discarded", type: "image", imageR2Key: "k.jpg" },
    ];
    const result = parseParts(
      baseBroadcast({ parts: JSON.stringify(parts) }),
      idGen(),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: "text", text: "hi", id: "id-1" });
    expect(result[1]).toMatchObject({
      type: "image",
      imageR2Key: "k.jpg",
      id: "id-2",
    });
  });

  it("parts が壊れた JSON のときは body にフォールバックする", () => {
    const result = parseParts(
      baseBroadcast({ parts: "not-json", body: "fallback" }),
      idGen(),
    );
    expect(result).toEqual([{ id: "id-1", type: "text", text: "fallback" }]);
  });

  it("複数パートで generateId が複数回呼ばれる", () => {
    let calls = 0;
    parseParts(
      baseBroadcast({
        parts: JSON.stringify([
          { type: "text", text: "a" },
          { type: "text", text: "b" },
          { type: "text", text: "c" },
        ]),
      }),
      () => {
        calls += 1;
        return `gen-${calls}`;
      },
    );
    expect(calls).toBe(3);
  });
});

describe("getImageUrl", () => {
  it("imageR2Key を path に埋め込んだ URL を返す", () => {
    const url = getImageUrl("foo.jpg");
    expect(url).toMatch(/\/broadcast\/media\/foo\.jpg$/);
  });
});
