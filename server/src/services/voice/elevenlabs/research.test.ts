import { beforeEach, describe, expect, it, vi } from "vitest";

const { knowledgeGenerate, webGenerate } = vi.hoisted(() => ({
  knowledgeGenerate: vi.fn(),
  webGenerate: vi.fn(),
}));

vi.mock("~/mastra/agents/knowledge-agent", () => ({
  createKnowledgeAgent: () => ({ generate: knowledgeGenerate }),
}));
vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  createWebResearcherAgent: () => ({ generate: webGenerate }),
}));
vi.mock("~/mastra/request-context", () => ({
  createRequestContext: () => ({}),
}));

const { runResearch } = await import("./research");

const env = {} as CloudflareBindings;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runResearch", () => {
  it("source=knowledge はナレッジ agent だけを呼び、メモをそのまま返す", async () => {
    knowledgeGenerate.mockResolvedValue({ text: "確認できた事実\n- 8時発\n" });
    const answer = await runResearch({
      env,
      question: "バスの時間",
      source: "knowledge",
    });
    expect(answer).toBe("確認できた事実\n- 8時発");
    expect(knowledgeGenerate).toHaveBeenCalledWith(
      "バスの時間",
      expect.anything(),
    );
    expect(webGenerate).not.toHaveBeenCalled();
  });

  it("source=web は Web agent だけを呼ぶ", async () => {
    webGenerate.mockResolvedValue({ text: "晴れ" });
    const answer = await runResearch({
      env,
      question: "今日の天気",
      source: "web",
    });
    expect(answer).toBe("晴れ");
    expect(knowledgeGenerate).not.toHaveBeenCalled();
  });

  it("agent が空文字を返したら定型の失敗文を返す", async () => {
    knowledgeGenerate.mockResolvedValue({ text: "" });
    const answer = await runResearch({
      env,
      question: "q",
      source: "knowledge",
    });
    expect(answer).toBe("ごめんね、うまく調べられなかったみたい。");
  });

  it("agent が例外を投げても定型の失敗文を返す", async () => {
    webGenerate.mockRejectedValue(new Error("upstream"));
    const answer = await runResearch({ env, question: "q", source: "web" });
    expect(answer).toBe("ごめんね、うまく調べられなかったみたい。");
  });
});
