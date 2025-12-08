import { createTool } from '@mastra/core/tools';
import { LibSQLVector } from '@mastra/libsql';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { z } from 'zod';

import { connectionUrl } from '../db';

export const knowledgeTool = createTool({
    id: 'knowledge-tool',
    description: '音威子府村に関する情報を検索します。ユーザーから村のことについて質問された場合に必ず使用してください。',
    inputSchema: z.object({
        query: z.string().describe('検索したいキーワードや質問内容'),
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            text: z.string(),
            score: z.number(),
        })),
    }),
    execute: async ({ query }) => {
        /* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
        const vectorStore = new LibSQLVector({
            id: 'knowledge-tool-vector',
            connectionUrl: connectionUrl,
        });

        const { embedding } = await embed({
            value: query,
            model: google.textEmbeddingModel('text-embedding-004'),
        });

        const results = await vectorStore.query({
            indexName: "embeddings",
            queryVector: embedding,
            topK: 20,
        });

        return {
            results: results.map((r: any) => ({
                text: r.metadata?.text || '',
                score: r.score || 0,
            })),
        };
    },
});
