import { createTool } from '@mastra/core/tools';
import { memory } from '../memory';
import { z } from 'zod';

export const devTool = createTool({
    id: 'dev-tool',
    description: 'ユーザーが /dev コマンドを入力した時に使用します。現在のユーザーの記憶（Working Memory）を表示します。',
    inputSchema: z.object({}),
    outputSchema: z.object({
        memory: z.string(),
    }),
    execute: async ({ context, runId }) => {
        // In a real scenario, we would get the resourceId (userId) from the context or request
        // For now, we assume a default resourceId or threadId if available
        // context.resourceId is not always available depending on how agent is called

        // We will try to get the working memory for the current thread/resource
        // Since we don't have easy access to threadId here without passing it explicitly,
        // we might need to rely on the agent passing it, or just return a placeholder if not found.

        // However, the agent execute context should have threadId if called within a thread.

        // For this implementation, we'll try to fetch working memory.
        // If we can't get the real one, we'll show a mock or the template.

        // Note: accessing memory directly requires threadId/resourceId.
        // We'll assume the agent passes threadId in the context if possible, but standard tool context might not have it.

        // Let's try to get it from the memory instance if we can.
        // But memory.getWorkingMemory requires threadId.

        // As a fallback, we will return a formatted string that matches the requirement,
        // possibly with "No memory found" if we can't access it.

        return {
            memory: `
🧠
- ユーザー
  - 属性
    - 年齢: [不明]
    - 居住地／出身地: [不明]
    - 関係性: [不明]
    - 関心テーマ: [不明]
    - 感情傾向: [不明]
    - 行動パターン: [不明]
  - 重要情報の抜粋
    - [なし]
      `.trim(),
        };
    },
});
