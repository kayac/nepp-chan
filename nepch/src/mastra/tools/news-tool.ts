import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { NewsService } from '../services/NewsService';

const newsService = new NewsService();

export const newsTool = createTool({
    id: 'news-tool',
    description: '村のニュースや噂話を管理するツールです。新しい出来事を記録したり、最近の話題を取得したりする時に使います。',
    inputSchema: z.object({
        action: z.enum(['add', 'get']).describe('実行するアクション: "add" はニュースを追加、"get" はニュースを取得'),
        content: z.string().optional().describe('ニュースの内容（追加時のみ必須）'),
        category: z.enum(['NEWS', 'INSIGHT']).optional().default('NEWS').describe('ニュースのカテゴリ'),
        sourceId: z.string().nullable().optional().describe('情報源となったユーザーID'),
        limit: z.number().optional().default(5).describe('取得するニュースの件数'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        data: z.any().optional(),
        message: z.string(),
    }),
    execute: async ({ action, content, category, sourceId, limit }) => {
        try {
            if (action === 'add') {
                if (!content) {
                    return {
                        success: false,
                        message: 'ニュースの内容が指定されていません。',
                    };
                }

                const id = await newsService.addNews(
                    content,
                    category || 'NEWS',
                    sourceId || undefined
                );

                return {
                    success: true,
                    data: { id },
                    message: 'ニュースを登録しました。',
                };
            } else if (action === 'get') {
                const news = await newsService.getRecentNews(limit);
                return {
                    success: true,
                    data: news,
                    message: `最新のニュースを${news.length}件取得しました。`,
                };
            }

            return {
                success: false,
                message: '不明なアクションです。',
            };
        } catch (error: any) {
            return {
                success: false,
                message: `エラーが発生しました: ${error.message}`,
            };
        }
    },
});
