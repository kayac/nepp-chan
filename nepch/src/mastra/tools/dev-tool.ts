import { createTool } from '@mastra/core/tools';
import { memory } from '../memory';
import { z } from 'zod';

import { requestContext } from '../../context';

export const devTool = createTool({
  id: 'dev-tool',
  description: 'ユーザーが /dev コマンドを入力した時に使用します。現在のユーザーの記憶（Working Memory）を表示します。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    memory: z.string(),
  }),
  execute: async ({ context, runId }) => {
    console.log('DevTool Context:', JSON.stringify(context, null, 2));

    const reqContext = requestContext.getStore();
    const resourceId = context?.resourceId || reqContext?.resourceId || 'default-user';
    const threadId = context?.threadId || reqContext?.threadId;

    if (!threadId) {
      return {
        memory: "エラー: threadIdが見つかりませんでした。メモリを表示できません。",
      };
    }

    try {
      const wm = await memory.getWorkingMemory({ threadId, resourceId });

      if (!wm) {
        return {
          memory: "メモリはまだ作成されていません。",
        };
      }

      // Format the memory for display
      return {
        memory: typeof wm === 'string' ? wm : JSON.stringify(wm, null, 2),
      };
    } catch (error: any) {
      return {
        memory: `エラーが発生しました: ${error.message}`,
      };
    }
  },
});
