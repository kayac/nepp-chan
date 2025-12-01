import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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

        // In a real implementation, we would search across all memories.
        // memory.vector.query({ ... }) with scope 'resource' or similar.

        return {
            success: true,
            message: '検索結果:',
            results: [
                '村人A: 最近クマが出たらしい',
                '村人B: そばの収穫時期について',
            ],
        };
    },
});
