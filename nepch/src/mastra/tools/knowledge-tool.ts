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
    execute: async ({ context }) => {
        const vectorStore = new LibSQLVector({
            connectionUrl: connectionUrl,
        });

        const { embedding } = await embed({
            value: context.query,
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
