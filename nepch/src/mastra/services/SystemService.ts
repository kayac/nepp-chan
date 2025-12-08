import { memory, storage } from '../memory';
import { db } from '../db';
import { connectionUrl } from '../db';
import { embed } from 'ai';
import { google } from '@ai-sdk/google';
import { LibSQLVector } from '@mastra/libsql';
import { nepChan } from '../agents/nep-chan';

export class SystemService {
    async checkVectorSearch() {
        console.log('Checking vector search functionality...');
        const results: any = {
            memoryVectorAccessible: false,
            searchSuccess: false,
            rawQuerySuccess: false,
            details: []
        };

        try {
            const memAny = memory as any;
            if (memAny.vector) {
                results.memoryVectorAccessible = true;
            }

            const query = "音威子府村";
            const embeddingModel = google.textEmbeddingModel('text-embedding-004');
            const { embedding } = await embed({
                model: embeddingModel,
                value: query,
            });

            const embeddingArray = Array.from(embedding);
            /* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
            const vector = new LibSQLVector({
                id: 'system-service-vector',
                connectionUrl: connectionUrl,
            });

            try {
                const searchRes = await vector.query({
                    indexName: "embeddings",
                    queryVector: embeddingArray,
                    topK: 5
                });
                results.searchSuccess = true;
                results.details.push(`Vector search returned ${searchRes.length} results.`);
            } catch (e: any) {
                results.details.push(`Vector search failed: ${e.message}`);
            }

            try {
                const vectorString = '[' + embeddingArray.join(',') + ']';
                const rawRes = await db.execute({
                    sql: `SELECT id, metadata FROM embeddings ORDER BY vector_distance_cos(embedding, vector(?)) ASC LIMIT 5`,
                    args: [vectorString]
                });
                results.rawQuerySuccess = true;
                results.details.push(`Raw SQL query returned ${rawRes.rows.length} results.`);
            } catch (e: any) {
                results.details.push(`Raw SQL query failed: ${e.message}`);
            }

        } catch (e: any) {
            results.details.push(`General error: ${e.message}`);
        }

        return results;
    }

    async checkToolRegistration() {
        console.log('Checking tool registration...');
        const tools = nepChan.listTools();
        const toolNames = Object.keys(tools);

        return {
            count: toolNames.length,
            tools: toolNames,
            status: toolNames.length > 0 ? 'ok' : 'error'
        };
    }

    async cleanupOldThreads(resourceId: string = 'default-user') {
        console.log(`Cleaning up threads for ${resourceId}...`);
        try {
            const { threads } = await memory.listThreadsByResourceId({ resourceId });
            let deletedCount = 0;

            const emptyThreads = [];
            for (const thread of threads) {
                const messageIds = (thread as any).messageIds || [];
                if (messageIds.length === 0) {
                    emptyThreads.push(thread.id);
                    continue;
                }

                const { messages } = await storage.listMessagesById({ messageIds });
                if (messages.length === 0) {
                    emptyThreads.push(thread.id);
                }
            }

            return {
                totalThreads: threads.length,
                emptyThreads: emptyThreads.length,
                emptyThreadIds: emptyThreads,
                message: `Found ${emptyThreads.length} empty threads.`
            };

        } catch (error: any) {
            return { success: false, message: `Cleanup failed: ${error.message}` };
        }
    }
}
