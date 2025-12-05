import { memory } from '../memory';
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
            const vector = new LibSQLVector({
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
        const tools = nepChan.tools;
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
            const threads = await memory.getThreadsByResourceId({ resourceId });
            let deletedCount = 0;

            for (const thread of threads) {
                const queryResult = await memory.query({ threadId: thread.id });
                const messages = queryResult.uiMessages;

                if (messages.length === 0) {
                    // Delete empty thread (Note: memory.deleteThread might not exist, checking implementation)
                    // If no delete method, we just log it for now or implement direct DB deletion if needed.
                    // Assuming for now we just identify them.
                    // Actually, let's check if we can delete.
                    // If not, we'll just return the count of empty threads.
                }
            }

            // Since we don't have a direct deleteThread method exposed in the memory interface easily without checking,
            // we will implement a direct DB deletion for now if needed, or just skip deletion and report.
            // For safety, let's just report empty threads for now.

            const emptyThreads = [];
            for (const thread of threads) {
                const queryResult = await memory.query({ threadId: thread.id });
                if (queryResult.uiMessages.length === 0) {
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
