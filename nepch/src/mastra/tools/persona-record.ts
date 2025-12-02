import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PersonaService } from '../services/PersonaService';

const personaService = new PersonaService();

export const personaRecord = createTool({
    id: 'persona-record',
    description: 'ユーザー（村人や観光客）の新しい情報を記録するためのツールです。相手から明確に新しい情報を聞いた時だけ使ってください。推測で記録しないでください。まだ誰か特定できていない場合でも、現在の会話相手の情報として記録します。',
    inputSchema: z.object({
        userId: z.string().describe('ユーザーID（会話の相手を一意に識別するID）'),
        data: z.object({
            name: z.string().optional().describe('ユーザーの名前'),
            attributes: z.any().optional().describe('ユーザーの属性（年齢、出身、職業など）'),
            current_concerns: z.any().optional().describe('現在の悩みや関心事'),
            summary: z.string().optional().describe('ユーザーに関する全体的なメモや要約'),
        }).describe('保存するデータ'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            if (!context.data) {
                return {
                    success: false,
                    message: '保存するデータが指定されていません。',
                };
            }

            await personaService.savePersona({
                id: context.userId,
                ...context.data,
            });

            return {
                success: true,
                message: 'ユーザー情報を保存しました。',
            };
        } catch (error: any) {
            return {
                success: false,
                message: `エラーが発生しました: ${error.message}`,
            };
        }
    },
});
