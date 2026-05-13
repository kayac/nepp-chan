import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../test-helpers/tool-context";
import { searchGoogleTool } from "./google-search-tool";

const env = {
  GOOGLE_GENERATIVE_AI_API_KEY: "key",
  GOOGLE_SEARCH_ENGINE_ID: "engine",
} as unknown as CloudflareBindings;

const envValues = { env };

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

afterEach(() => {
  fetchSpy.mockReset();
});

describe("searchGoogleTool.execute", () => {
  it("API key / engine id が無いと API_KEY_MISSING", async () => {
    const result = await callTool(
      searchGoogleTool,
      { query: "x" },
      { env: {} },
    );

    expect(result.error).toBe("API_KEY_MISSING");
    expect(result.results).toEqual([]);
  });

  it("Custom Search 結果を整形して返す", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              title: "T",
              snippet: "S",
              link: "https://example.com",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await callTool(
      searchGoogleTool,
      { query: "音威子府" },
      envValues,
    );

    expect(result.results).toEqual([
      { title: "T", snippet: "S", url: "https://example.com" },
    ]);
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("key=key");
    expect(calledUrl).toContain("cx=engine");
    expect(calledUrl).toContain(encodeURIComponent("音威子府"));
  });

  it("429 はレート制限エラー", async () => {
    fetchSpy.mockResolvedValue(new Response("Rate Limit", { status: 429 }));

    const result = await callTool(searchGoogleTool, { query: "x" }, envValues);

    expect(result.error).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("非 OK レスポンスは error JSON.message を抽出", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "API key invalid" } }), {
        status: 403,
      }),
    );

    const result = await callTool(searchGoogleTool, { query: "x" }, envValues);

    expect(result.error).toBe("API key invalid");
  });

  it("items が無いと空配列", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const result = await callTool(searchGoogleTool, { query: "x" }, envValues);

    expect(result.results).toEqual([]);
  });

  it("fetch が throw するとエラー文字列を返す", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));

    const result = await callTool(searchGoogleTool, { query: "x" }, envValues);

    expect(result.error).toBe("network down");
  });
});
