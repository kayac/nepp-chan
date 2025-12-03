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
        error: z.string().optional(),
        source: z.string().optional(),
    }),
    execute: async ({ context }) => {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

        if (!apiKey || !engineId) {
            console.error('Google Search API Key or Engine ID is missing.');
            return {
                results: []
            };
        }

        try {
            const response = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(context.query)}`
            );

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Google Custom Search API Rate Limit Exceeded');
                    return {
                        results: [],
                        error: 'RATE_LIMIT_EXCEEDED',
                        source: 'Google Custom Search API'
                    };
                }

                const errorText = await response.text();
                console.error('Google Search API Error:', errorText);
                return { results: [] };
            }

            const data = await response.json();
            const items = data.items || [];

            const results = items.map((item: any) => ({
                title: item.title,
                snippet: item.snippet,
                url: item.link,
            }));

            return {
                results: results
            };
        } catch (error) {
            console.error('Search tool error:', error);
            return {
                results: []
            };
        }
    },
});
