import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const BASE_URL = "https://www.vill.otoineppu.hokkaido.jp";

export const villageSearchTool = createTool({
  id: "village-search",
  description:
    "音威子府村の公式サイトの検索URLを生成します。このURLをPlaywrightで開いて検索結果を取得してください。",
  inputSchema: z.object({
    query: z
      .string()
      .describe("検索したいキーワード（例: 役場、手続き、施設）"),
  }),
  outputSchema: z.object({
    searchUrl: z.string(),
    source: z.string(),
  }),
  execute: async (inputData) => {
    const searchUrl = `${BASE_URL}/result.html?q=${encodeURIComponent(inputData.query)}`;
    return {
      searchUrl,
      source: "音威子府村公式サイト",
    };
  },
});
