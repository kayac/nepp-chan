import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PersonaService } from '../services/PersonaService';

const personaService = new PersonaService();

export const personaRecall = createTool({
    id: 'persona-recall',
    description: 'ユーザー（村人や観光客）の情報を思い出すためのツールです。会話の最初や、相手から「覚えている？」と聞かれた時に使います。',
    inputSchema: z.object({
        query: z.string().describe('ユーザーの特徴やキーワード（例：「東京出身」「蕎麦が好き」「タナカさん」など）'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        candidates: z.array(z.any()).optional(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            const candidates = await personaService.searchPersonas(context.query);

            if (candidates.length > 0) {
                return {
                    success: true,
                    candidates: candidates,
                    message: `${candidates.length}人の候補が見つかりました。`,
                };
            } else {
                return {
                    success: true, // Not found is not an error
                    candidates: [],
                    message: '該当するユーザーは見つかりませんでした。初対面の可能性があります。',
                };
            }
        } catch (error: any) {
            return {
                success: false,
                message: `エラーが発生しました: ${error.message}`,
            };
        }
    },
});
