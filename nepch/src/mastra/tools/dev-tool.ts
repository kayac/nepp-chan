
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { memory, storage } from '../memory';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { PersonaSchema } from '../types/PersonaSchema';

export const devTool = createTool({
  id: 'dev-tool',
  description: '開発者用ツール: 現在の会話からペルソナ抽出のプレビューを行います。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    preview: z.string(),
  }),
  execute: async (_input, context) => {
    try {
      const threadId = (context as any).threadId;
      if (!threadId) {
        return { preview: "スレッドIDが見つかりません。" };
      }

      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        return { preview: "スレッドが見つかりません。" };
      }

      const messageIds = (thread as any).messageIds || [];
      if (messageIds.length === 0) {
        return { preview: "メッセージがまだありません。" };
      }

      const { messages } = await storage.listMessagesById({ messageIds });

      if (messages.length === 0) {
        return {
          preview: "メッセージがまだありません。",
        };
      }

      const conversationText = messages.map((m: any) => `${m.role}: ${m.content} `).join('\n');
      const model = google('gemini-2.0-flash');

      const { object } = await generateObject({
        model: model,
        schema: PersonaSchema,
        messages: [
          { role: 'system', content: 'Analyze the following conversation and extract user information based on the defined schema. Be precise and infer attributes where possible.' },
          { role: 'user', content: conversationText }
        ],
      });

      const previewText = `
【ペルソナ記録プレビュー(New Schema)】
--------------------------------------------------
■ User Attributes
  - 年齢: ${object.age}
- 居住地: ${object.location}
- 関係性: ${object.relationship}
- 関心テーマ: ${object.interestTheme.join(', ')}
- 感情状態: ${object.emotionalState}
- 行動パターン: ${object.behaviorPattern}

■ Empathy Map
  - Says(発言): ${object.says}
- Thinks(思考): ${object.thinks}
- Does(行動): ${object.does}
- Feels(感情): ${object.feels}

■ Important Information
${object.importantItems.map(item => `- ${item}`).join('\n')}
--------------------------------------------------
※ 「記憶を整理(Debug)」ボタンを押すと、この形式で保存・ベクトル化されます。
`;

      return {
        preview: previewText,
      };
    } catch (error: any) {
      return {
        preview: `エラーが発生しました: ${error.message} `,
      };
    }
  },
});

