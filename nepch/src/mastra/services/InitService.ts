import { db } from '../db';
import { connectionUrl } from '../db';
import { LibSQLVector } from '@mastra/libsql';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { MDocument } from '@mastra/rag';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class InitService {
    async initializeDatabase() {
        console.log('Setting up database tables...');
        try {
            // Create villagers table
            await db.execute(`
              CREATE TABLE IF NOT EXISTS villagers (
                id TEXT PRIMARY KEY,
                name TEXT,
                attributes TEXT,
                current_concerns TEXT,
                last_seen TEXT,
                summary TEXT
              )
            `);
            console.log('Created villagers table.');

            // Create village_news table
            await db.execute(`
              CREATE TABLE IF NOT EXISTS village_news (
                id TEXT PRIMARY KEY,
                content TEXT,
                category TEXT,
                source_villager_id TEXT,
                created_at TEXT
              )
            `);
            console.log('Created village_news table.');

            // Create conversation_links table
            await db.execute(`
              CREATE TABLE IF NOT EXISTS conversation_links (
                id TEXT PRIMARY KEY,
                source_thread_id TEXT,
                target_thread_id TEXT,
                reason TEXT,
                confidence REAL,
                created_at TEXT
              )
            `);
            console.log('Created conversation_links table.');

            return { success: true, message: 'Database tables initialized successfully.' };
        } catch (error: any) {
            console.error('Error setting up database:', error);
            return { success: false, message: `Database initialization failed: ${error.message}` };
        }
    }

    async generateEmbeddings() {
        console.log('Starting knowledge embedding...');
        try {
            /* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
            const vectorStore = new LibSQLVector({
                id: 'init-service-vector',
                connectionUrl: connectionUrl,
            });

            await vectorStore.createIndex({
                indexName: "embeddings",
                dimension: 768, // Google text-embedding-004 dimension
                metric: "cosine",
            });

            // Assuming knowledge directory is at project root/knowledge
            // This service file is in src/mastra/services, so root is ../../../
            const knowledgeDir = path.resolve(__dirname, '../../../knowledge');

            if (!fs.existsSync(knowledgeDir)) {
                return { success: false, message: `Knowledge directory not found at ${knowledgeDir}` };
            }

            const files = fs.readdirSync(knowledgeDir).filter(file => file.endsWith('.md') && file !== 'agent_skills.md');
            let totalChunks = 0;

            for (const file of files) {
                console.log(`Processing ${file}...`);
                const filePath = path.join(knowledgeDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');

                const doc = MDocument.fromText(content);

                const chunks = await doc.chunk({
                    strategy: "recursive",
                    maxSize: 256,
                    overlap: 50,
                });

                for (let i = 0; i < chunks.length; i++) {
                    const { embedding } = await embed({
                        value: chunks[i].text,
                        model: google.textEmbeddingModel('text-embedding-004'),
                    });

                    await vectorStore.upsert({
                        indexName: "embeddings",
                        vectors: [embedding],
                        metadata: [{
                            source: file,
                            text: chunks[i].text,
                        }],
                        ids: [`${file}-${i}`],
                    });
                }
                totalChunks += chunks.length;
                console.log(`Embedded ${chunks.length} chunks from ${file}`);
            }

            console.log('Knowledge embedding complete!');
            return { success: true, message: `Knowledge embedding complete! Processed ${files.length} files and ${totalChunks} chunks.` };
        } catch (error: any) {
            console.error('Error generating embeddings:', error);
            return { success: false, message: `Embedding generation failed: ${error.message}` };
        }
    }

    async checkEnvironment() {
        const requiredVars = [
            'GOOGLE_GENERATIVE_AI_API_KEY',
            'APP_PORT'
        ];

        const missing = requiredVars.filter(v => !process.env[v]);
        const status = {
            ok: missing.length === 0,
            missing,
            env: {
                APP_PORT: process.env.APP_PORT,
                GOOGLE_KEY_SET: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
            }
        };

        return status;
    }
}
