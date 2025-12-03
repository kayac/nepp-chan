import { memory } from '../mastra/memory';
import { db } from '../mastra/db';
import { embed } from 'ai';
import { google } from '@ai-sdk/google';
import { LibSQLVector } from '@mastra/libsql';

async function inspectMemory() {
    console.log('Inspecting memory object...');
    const memAny = memory as any;

    if (memAny.vector) {
        console.log('✅ memory.vector is accessible');
    }

    try {
        if (memAny.vector) {
            console.log('Attempting vector search...');
            const query = "音威子府村";
            const embeddingModel = google.textEmbeddingModel('text-embedding-004');

            const { embedding } = await embed({
                model: embeddingModel,
                value: query,
            });

            console.log('Generated embedding length:', embedding.length);
            const embeddingArray = Array.from(embedding);

            // Try manual instantiation
            console.log('Instantiating LibSQLVector manually...');
            const vector = new LibSQLVector({
                connectionUrl: 'file:local.db',
            });

            let results: any[] = [];
            try {
                console.log('Trying query(embeddingArray)...');
                // @ts-ignore
                results = await vector.query(embeddingArray);
                console.log('Query(embeddingArray) success, results:', results.length);
            } catch (e) {
                console.error('Query(embeddingArray) failed:', e);
            }

            if (results.length === 0) {
                try {
                    console.log('Trying query(embeddingArray, 10)...');
                    // @ts-ignore
                    results = await vector.query(embeddingArray, 10);
                    console.log('Query(embeddingArray, 10) success, results:', results.length);
                } catch (e) {
                    console.error('Query(embeddingArray, 10) failed:', e);
                }
            }

            // Try raw SQL query
            console.log('Trying raw SQL query...');
            try {
                const vectorString = '[' + embeddingArray.join(',') + ']';
                const sql = `
                    SELECT vector_id, metadata 
                    FROM memory_messages_768 
                    ORDER BY vector_distance_cos(embedding, vector('${vectorString}')) ASC 
                    LIMIT 10
                `;
                // Note: passing vector as string literal might be too long for some drivers, 
                // but let's try. Or use parameter binding if supported for vector().

                // Using parameter binding for vector string
                const result = await db.execute({
                    sql: `SELECT vector_id, metadata FROM memory_messages_768 ORDER BY vector_distance_cos(embedding, vector(?)) ASC LIMIT 10`,
                    args: [vectorString]
                });

                console.log('Raw SQL query success, found:', result.rows.length);
                if (result.rows.length > 0) {
                    console.log('Sample raw result:', result.rows[0]);
                }
            } catch (e) {
                console.error('Raw SQL query failed:', e);
            }
        }
    } catch (e) {
        console.error('Error during search test:', e);
    }
}

inspectMemory();
