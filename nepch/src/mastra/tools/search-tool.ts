import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const searchTool = createTool({
    id: 'search-tool',
    description: 'インターネットで最新の情報を検索します。ユーザーから「調べてみようか？」と言われた場合や、最新の情報が必要な場合に使用してください。',
    inputSchema: z.object({
        query: z.string().describe('検索したいキーワードや質問内容'),
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            title: z.string(),
            snippet: z.string(),
            url: z.string(),
        })),
    }),
    execute: async ({ context }) => {
        // TODO: Implement actual web search (e.g. using Tavily, Google Custom Search, etc.)
        // For now, we return an empty list to simulate "no results found" for the fallback test,
        // or we could return mock data.

        console.log('Searching for:', context.query);

        // Mocking a "no result" scenario to test the fallback message
        // "理由まではわからなかったみたい、ごめんね"
        return {
            results: []
        };
    },
});
