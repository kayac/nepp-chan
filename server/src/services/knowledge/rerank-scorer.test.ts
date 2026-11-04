import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  booleanAnswer,
  decision,
  doDecideMock,
} from "~/__tests__/helpers/jev-provider";

const { generateMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    generate = generateMock;
  },
}));

vi.mock(
  "@ai-sdk/typesafe-ai",
  () => import("~/__tests__/helpers/jev-provider"),
);

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { scoreRelevance } = await import("./rerank-scorer");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const jevResponse = (probabilities: number[]) =>
  decision(
    Object.fromEntries(
      probabilities.map((p, i) => [`p${i}`, booleanAnswer(p)]),
    ),
  );

beforeEach(() => {
  generateMock.mockReset();
  doDecideMock.mockReset();
});

describe("scoreRelevance（jev）", () => {
  it("候補を 1 回の jev 呼び出しでまとめて採点し、候補の順に関連度を返す", async () => {
    doDecideMock.mockResolvedValueOnce(jevResponse([0.82, 0.1, 0.5]));

    const scores = await scoreRelevance(
      "寮費は？",
      ["月額30,000円", "給食の献立", "入寮の手続き"],
      contextWithKey("k"),
    );

    expect(scores).toEqual([0.82, 0.1, 0.5]);
    expect(doDecideMock).toHaveBeenCalledTimes(1);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("候補が無ければ jev を呼ばない", async () => {
    expect(await scoreRelevance("q", [], contextWithKey("k"))).toEqual([]);
    expect(doDecideMock).not.toHaveBeenCalled();
  });
});

describe("scoreRelevance（luna フォールバック）", () => {
  it("TYPESAFE_API_KEY が無ければ jev を呼ばず、候補ごとに luna で採点する", async () => {
    generateMock
      .mockResolvedValueOnce({ text: "0.7" })
      .mockResolvedValueOnce({ text: "0.2" });

    expect(await scoreRelevance("q", ["a", "b"], contextWithKey())).toEqual([
      0.7, 0.2,
    ]);
    expect(doDecideMock).not.toHaveBeenCalled();
  });

  it("jev が失敗したら、候補ごとに luna で採点する", async () => {
    doDecideMock.mockRejectedValueOnce(new Error("jev responded 429"));
    generateMock.mockResolvedValue({ text: "0.6" });
    const ctx = contextWithKey("k");

    expect(await scoreRelevance("q", ["passage text", "b"], ctx)).toEqual([
      0.6, 0.6,
    ]);
    expect(generateMock).toHaveBeenCalledWith(
      expect.stringContaining("passage text"),
      expect.objectContaining({ requestContext: ctx }),
    );
  });

  it("jev の答えが候補の一部しか無ければ、候補ごとに luna で採点する", async () => {
    doDecideMock.mockResolvedValueOnce(jevResponse([0.9]));
    generateMock.mockResolvedValue({ text: "0.3" });

    expect(await scoreRelevance("q", ["a", "b"], contextWithKey("k"))).toEqual([
      0.3, 0.3,
    ]);
  });
});
