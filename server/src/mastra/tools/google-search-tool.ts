import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface GoogleSearchResponse {
  items?: {
    title: string;
    snippet: string;
    link: string;
  }[];
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface SearchOutput {
  results: SearchResult[];
  error?: string;
  source: string;
}

const SOURCE = "Google Custom Search API";

export const searchGoogleTool = createTool({
  id: "searchGoogleTool",
  description: "Google検索を使ってインターネットから最新の情報を検索します。",
  inputSchema: z.object({
    query: z.string().describe("検索したいキーワードや質問内容"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      }),
    ),
    error: z.string().optional(),
    source: z.string(),
  }),
  execute: async (inputData, context) => {
    const env = context?.requestContext?.get("env") as
      | CloudflareBindings
      | undefined;
    const apiKey = env?.GOOGLE_GENERATIVE_AI_API_KEY;
    const engineId = env?.GOOGLE_SEARCH_ENGINE_ID;
    return await searchGoogle(inputData.query, apiKey, engineId);
  },
});

const searchGoogle = async (
  query: string,
  apiKey?: string,
  engineId?: string,
): Promise<SearchOutput> => {
  if (!apiKey || !engineId) {
    console.error("Google Search API Key or Engine ID is missing.");
    return {
      results: [],
      error: "API_KEY_MISSING",
      source: SOURCE,
    };
  }

  try {
    const response = await fetchGoogleSearch(apiKey, engineId, query);

    if (!response.ok) {
      return await handleErrorResponse(response);
    }

    const data = (await response.json()) as GoogleSearchResponse;
    const results = mapSearchResults(data.items);

    return { results, source: SOURCE };
  } catch (error) {
    console.error("Search tool error:", error);
    return {
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
      source: SOURCE,
    };
  }
};

const fetchGoogleSearch = (apiKey: string, engineId: string, query: string) => {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&lr=lang_ja&gl=jp`;
  return fetch(url);
};

const handleErrorResponse = async (
  response: Response,
): Promise<SearchOutput> => {
  if (response.status === 429) {
    console.warn("Google Custom Search API Rate Limit Exceeded");
    return {
      results: [],
      error: "RATE_LIMIT_EXCEEDED",
      source: SOURCE,
    };
  }

  const errorText = await response.text();
  console.error("Google Search API Error:", errorText);

  let errorMessage = "Unknown error";
  try {
    const errorJson = JSON.parse(errorText);
    errorMessage = errorJson.error?.message || errorText;
  } catch {
    errorMessage = errorText;
  }

  return {
    results: [],
    error: errorMessage,
    source: SOURCE,
  };
};

const mapSearchResults = (
  items: GoogleSearchResponse["items"],
): SearchResult[] => {
  if (!items) return [];

  return items.map((item) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
  }));
};
