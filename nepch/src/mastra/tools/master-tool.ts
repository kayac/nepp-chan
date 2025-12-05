import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { connectionUrl } from '../db';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin';

export const masterTool = createTool({
    id: 'master-tool',
    description: 'ユーザーが /master コマンドを入力した時に使用します。村長専用モードです。パスワード認証が必要です。',
    inputSchema: z.object({
        password: z.string().describe('ユーザーが入力したパスワード'),
        query: z.string().optional().describe('検索したい内容'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        results: z.array(z.string()).optional(),
    }),
    execute: async ({ context }) => {
        if (context.password !== MASTER_PASSWORD) {
            return {
                success: false,
                message: 'パスワードが違います。',
            };
        }

        if (!context.query) {
            return {
                success: true,
                message: '認証成功。検索したい内容を入力してください。',
            };
        }

        try {
            const { LibSQLVector } = await import('@mastra/libsql');
            const { google } = await import('@ai-sdk/google');
            const { embed } = await import('ai');

            const vectorStore = new LibSQLVector({
                connectionUrl: connectionUrl,
            });

            const { embedding } = await embed({
                value: context.query,
                model: google.textEmbeddingModel('text-embedding-004'),
            });

            // Search across all indices or a specific one if needed.
            // For now, we assume 'embeddings' index is used for general knowledge/memory.
            // Adjust 'indexName' if you have multiple indices.
            const results = await vectorStore.query({
                indexName: "embeddings",
                queryVector: embedding,
                topK: 5,
            });

            const formattedResults = results.map((r: any) =>
                `[${r.score.toFixed(2)}] ${r.metadata?.text || 'No text'}`
            );

            return {
                success: true,
                message: `検索結果 (${formattedResults.length}件):`,
                results: formattedResults,
            };
        } catch (error: any) {
            console.error('Master tool error:', error);
            return {
                success: false,
                message: `検索中にエラーが発生しました: ${error.message}`,
            };
        }
    },
});
