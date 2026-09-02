import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/pii", () => ({
  redactPii: vi.fn(),
}));

const { redactPii } = await import("~/lib/pii");
const { buildDecisionEvidence } = await import("./review-evidence");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildDecisionEvidence", () => {
  it("質問・回答・検索クエリを伏せ、根拠は source#section で残す", async () => {
    vi.mocked(redactPii).mockImplementation(async (texts) =>
      texts.map((text) => text.replace("田中", "[NAME]")),
    );

    const evidence = await buildDecisionEvidence({
      conversation: {
        question: "田中さんの家の水道",
        answer: "田中さんへ連絡",
      },
      runs: [
        {
          query: "田中 水道",
          hits: [
            { source: "water.md", section: "故障時", score: 0.9 },
            { source: "contact.md", score: 0.5 },
          ],
        },
      ],
    });

    expect(evidence).toEqual({
      question: "[NAME]さんの家の水道",
      answer: "[NAME]さんへ連絡",
      runs: [
        { query: "[NAME] 水道", sources: ["water.md#故障時", "contact.md"] },
      ],
    });
  });

  it("会話が取得できなければ question / answer は null", async () => {
    vi.mocked(redactPii).mockImplementation(async (texts) => texts);

    const evidence = await buildDecisionEvidence({
      conversation: null,
      runs: [{ query: "ゴミ 分別", hits: [] }],
    });

    expect(evidence.question).toBeNull();
    expect(evidence.answer).toBeNull();
    expect(evidence.runs).toEqual([{ query: "ゴミ 分別", sources: [] }]);
  });

  it("伏せる処理に失敗したら本文を落として根拠だけ残す", async () => {
    vi.mocked(redactPii).mockRejectedValue(new Error("model unavailable"));

    const evidence = await buildDecisionEvidence({
      conversation: { question: "田中さんの家", answer: "窓口へ" },
      runs: [
        { query: "田中 水道", hits: [{ source: "water.md", score: 0.9 }] },
      ],
    });

    expect(evidence).toEqual({
      question: null,
      answer: null,
      runs: [{ query: "", sources: ["water.md"] }],
    });
  });
});
