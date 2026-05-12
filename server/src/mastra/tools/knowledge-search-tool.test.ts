import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/knowledge/search", () => ({
  searchKnowledge: vi.fn(),
}));

const { searchKnowledge } = await import("~/services/knowledge/search");
const { knowledgeSearchTool } = await import("./knowledge-search-tool");

import { callTool } from "../../test-helpers/tool-context";

describe("knowledgeSearchTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("VECTORIZE binding が無いと VECTORIZE_NOT_CONFIGURED", async () => {
    const result = await callTool(
      knowledgeSearchTool,
      { query: "x" },
      { env: { GOOGLE_GENERATIVE_AI_API_KEY: "k" } as never },
    );

    expect(result.error).toBe("VECTORIZE_NOT_CONFIGURED");
  });

  it("API key が無いと API_KEY_MISSING", async () => {
    const result = await callTool(
      knowledgeSearchTool,
      { query: "x" },
      { env: { VECTORIZE: {} } as never },
    );

    expect(result.error).toBe("API_KEY_MISSING");
  });

  it("正常系: searchKnowledge を呼んで結果を返す", async () => {
    vi.mocked(searchKnowledge).mockResolvedValue({
      results: [
        {
          content: "村の歴史",
          score: 0.9,
          source: "history.md",
        },
      ],
    });

    const env = {
      VECTORIZE: {} as VectorizeIndex,
      GOOGLE_GENERATIVE_AI_API_KEY: "key",
    } as unknown as CloudflareBindings;

    const result = await callTool(
      knowledgeSearchTool,
      { query: "歴史" },
      { env },
    );

    expect(result.results).toHaveLength(1);
    expect(searchKnowledge).toHaveBeenCalledWith("歴史", env.VECTORIZE, "key");
  });
});
