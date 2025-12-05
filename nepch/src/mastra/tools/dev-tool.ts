import { createTool } from '@mastra/core/tools';
import { memory } from '../memory';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

import { requestContext } from '../../context';

export const devTool = createTool({
  id: 'dev-tool',
  description: 'ユーザーが /dev コマンドを入力した時に使用します。現在の会話から、Villagersのペルソナに記録されるべき情報を先に見ることができます。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    preview: z.string(),
  }),
  execute: async ({ context, runId }) => {
    console.log('DevTool Context:', JSON.stringify(context, null, 2));

    const reqContext = requestContext.getStore();
    const resourceId = context?.resourceId || reqContext?.resourceId || 'default-user';
    const threadId = context?.threadId || reqContext?.threadId;

    if (!threadId) {
      return {
        preview: "エラー: threadIdが見つかりませんでした。分析できません。",
      };
    }

    try {
      // Get messages
      const queryResult = await memory.query({ threadId });
      const messages = queryResult.uiMessages;

      if (messages.length === 0) {
        return {
          preview: "メッセージがまだありません。",
        };
      }

      // Prepare conversation text
      const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');

      // Call LLM to summarize and extract info (Same logic as BatchService)
      const model = google('gemini-2.0-flash');

      const { object } = await generateObject({
        model: model,
        schema: z.object({
          attributes: z.array(z.object({
            key: z.string(),
            value: z.string()
          })).describe('User attributes extracted from conversation (e.g., age, location, hobbies)'),
          summary: z.string().describe('Brief summary of the conversation topics'),
          interests: z.array(z.string()).describe('List of user interests mentioned'),
        }),
        messages: [
          { role: 'system', content: 'Analyze the following conversation and extract user information. Focus on attributes, interests, and a general summary.' },
          { role: 'user', content: conversationText }
        ],
      });

      const previewText = `
【ペルソナ記録プレビュー】
--------------------------------------------------
■ サマリー
${object.summary}

■ 抽出された属性
${object.attributes.map(a => `- ${a.key}: ${a.value}`).join('\n')}

■ 関心事
${object.interests.join(', ')}
--------------------------------------------------
※ この情報は「記憶を整理 (Debug)」ボタンを押すと保存されます。
`;

      return {
        preview: previewText,
      };
    } catch (error: any) {
      return {
        preview: `エラーが発生しました: ${error.message}`,
      };
    }
  },
});

