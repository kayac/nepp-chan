import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const verifyPassword = createTool({
    id: 'verify-password',
    description: '管理者パスワードを検証します。/master コマンドが使用された場合に、エージェントへの委譲前に必ず使用してください。',
    inputSchema: z.object({
        password: z.string().describe('検証するパスワード'),
    }),
    outputSchema: z.object({
        isValid: z.boolean(),
        message: z.string(),
    }),
    execute: async ({ password }) => {
        const isValid = password === process.env.MASTER_PASSWORD;
        return {
            isValid,
            message: isValid ? 'パスワードは正しいです。' : 'パスワードが違います。',
        };
    },
});
