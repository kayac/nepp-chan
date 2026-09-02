import { beforeEach, describe, expect, it, vi } from "vitest";

const processInput = vi.fn();

vi.mock("@mastra/core/processors", () => ({
  PIIDetector: class {
    processInput = processInput;
  },
}));

const { redactPii, redactStructuredPii } = await import("./pii");

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

describe("redactStructuredPii", () => {
  it.each([
    ["090-1234-5678", "[PHONE]"],
    ["011-231-4111", "[PHONE]"],
    ["01656-5-3311", "[PHONE]"],
    ["09012345678", "[PHONE]"],
    ["mura@example.jp", "[EMAIL]"],
    ["〒098-2501", "[POSTAL-CODE]"],
    ["〒 098-2501", "[POSTAL-CODE]"],
  ])("%s を伏せる", (input, expected) => {
    expect(redactStructuredPii(input)).toBe(expected);
  });

  it.each(["2026-09-02", "料金は 100-2000 円", "8時30分", "098-2501"])(
    "%s は伏せない",
    (input) => {
      expect(redactStructuredPii(input)).toBe(input);
    },
  );

  it("文中の電話番号だけを伏せる", () => {
    expect(redactStructuredPii("役場は01656-5-3311です")).toBe(
      "役場は[PHONE]です",
    );
  });
});

describe("redactPii と組み合わせたとき", () => {
  it("PIIDetector が原文を返しても電話番号とメールは伏せる", async () => {
    respondWith((text) => text);

    expect(
      await redactPii(["090-1234-5678 か mura@example.jp へ連絡"]),
    ).toEqual(["[PHONE] か [EMAIL] へ連絡"]);
  });
});
