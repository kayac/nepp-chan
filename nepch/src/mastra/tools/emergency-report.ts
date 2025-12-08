import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { NewsService } from '../services/NewsService';

const newsService = new NewsService();

export const emergencyReport = createTool({
    id: 'emergency-report',
    description: '緊急事態（クマ出没、火事、不審者、事故など）を即座に報告・記録するためのツールです。ユーザーから危険な情報や緊急性の高い情報を聞いた場合は、他のツールではなく必ずこのツールを最優先で使用してください。',
    inputSchema: z.object({
        type: z.enum(['DANGER', 'INCIDENT', 'URGENT_INFO']).describe('緊急事態の種類（DANGER: 危険、INCIDENT: 事件・事故、URGENT_INFO: その他緊急情報）'),
        content: z.string().describe('緊急事態の詳細内容（何が、どこで、どうしたか）'),
        location: z.string().optional().describe('発生場所（わかる場合）'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        reportId: z.string().optional(),
    }),
    execute: async ({ content, location }) => {
        try {
            // Format content with location if available
            let fullContent = content;
            if (location) {
                fullContent = `【場所: ${location}】 ${fullContent}`;
            }

            // Add to NewsService with INSIGHT category (or we could add a new URGENT category to the service later)
            // For now, we prepend [緊急] to make it stand out
            const id = await newsService.addNews(
                `[緊急] ${fullContent}`,
                'NEWS', // Using NEWS category but marking as urgent in content
                'emergency-report'
            );

            console.log(`🚨 Emergency Report Logged: ${fullContent}`);

            return {
                success: true,
                message: '緊急情報を記録し、関係各所に共有可能な状態にしました。',
                reportId: id,
            };
        } catch (error: any) {
            console.error('Failed to log emergency report:', error);
            return {
                success: false,
                message: `緊急情報の記録に失敗しました: ${error.message}`,
            };
        }
    },
});
