import { beforeEach, describe, expect, it, vi } from "vitest";

const processInput = vi.fn();

vi.mock("@mastra/core/processors", () => ({
  PIIDetector: class {
    processInput = processInput;
  },
}));

const { redactPii } = await import("./pii");

type InputMessage = {
  id: string;
  content: { parts: Array<{ type: string; text: string }> };
};

const respondWith = (
  transform: (text: string) => string,
  options: { dropIds?: string[] } = {},
) => {
  processInput.mockImplementation(async ({ messages }) =>
    (messages as InputMessage[])
      .filter((message) => !options.dropIds?.includes(message.id))
      .map((message) => ({
        id: message.id,
        role: "user" as const,
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: "text" as const,
              text: transform(message.content.parts[0].text),
            },
          ],
        },
      })),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redactPii", () => {
  it("検出された箇所を伏せた文字列を同じ順序で返す", async () => {
    respondWith((text) => text.replace("田中", "[NAME]"));

    expect(await redactPii(["田中さんの家", "窓口は役場です"])).toEqual([
      "[NAME]さんの家",
      "窓口は役場です",
    ]);
  });

  it("空文字はそのまま返し、検出にも渡さない", async () => {
    respondWith((text) => text.replace("田中", "[NAME]"));

    expect(await redactPii(["", "田中さん", "  "])).toEqual([
      "",
      "[NAME]さん",
      "  ",
    ]);
    expect(processInput.mock.calls[0][0].messages).toHaveLength(1);
  });

  it("全て空文字なら検出を呼ばない", async () => {
    expect(await redactPii(["", ""])).toEqual(["", ""]);
    expect(processInput).not.toHaveBeenCalled();
  });

  it("伏せきれず除外されたテキストは空文字にして位置を保つ", async () => {
    respondWith((text) => text, { dropIds: ["0"] });

    expect(await redactPii(["田中さんの家", "窓口は役場です"])).toEqual([
      "",
      "窓口は役場です",
    ]);
  });
});
