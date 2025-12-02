import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface NewsItem {
    id: string;
    content: string;
    category: 'NEWS' | 'INSIGHT';
    source_villager_id?: string;
    created_at: string;
}

export class NewsService {
    async addNews(content: string, category: 'NEWS' | 'INSIGHT', sourceId?: string): Promise<string> {
        const id = uuidv4();
        const createdAt = new Date().toISOString();

        await db.execute({
            sql: `
        INSERT INTO village_news (id, content, category, source_villager_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
            args: [id, content, category, sourceId || null, createdAt],
        });

        return id;
    }

    async getRecentNews(limit: number = 5): Promise<NewsItem[]> {
        const result = await db.execute({
            sql: 'SELECT * FROM village_news ORDER BY created_at DESC LIMIT ?',
            args: [limit],
        });

        return result.rows.map(row => ({
            id: row.id as string,
            content: row.content as string,
            category: row.category as 'NEWS' | 'INSIGHT',
            source_villager_id: row.source_villager_id as string,
            created_at: row.created_at as string,
        }));
    }
}
