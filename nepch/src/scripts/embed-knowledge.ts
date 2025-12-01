import { MDocument } from '@mastra/rag';
import { LibSQLVector } from '@mastra/libsql';
import { google } from '@ai-sdk/google';
import { embedMany } from 'ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function embedKnowledge() {
    console.log('Starting knowledge embedding...');

    const vectorStore = new LibSQLVector({
        connectionUrl: 'file:local.db',
    });

    await vectorStore.createIndex({
        indexName: "embeddings",
        dimension: 768, // Google text-embedding-004 dimension
        metric: "cosine",
    });

    const knowledgeDir = path.resolve(__dirname, '../../knowledge');
    const files = fs.readdirSync(knowledgeDir).filter(file => file.endsWith('.md'));

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        const doc = MDocument.fromText(content);

        const chunks = await doc.chunk({
            strategy: "recursive",
            size: 512,
            overlap: 50,
        });

        const { embeddings } = await embedMany({
            values: chunks.map((chunk) => chunk.text),
            model: google.textEmbeddingModel('text-embedding-004'),
        });

        await vectorStore.upsert({
            indexName: "embeddings",
            vectors: embeddings,
            metadata: chunks.map((chunk) => ({
                source: file,
                text: chunk.text,
            })),
            ids: chunks.map((_, i) => `${file}-${i}`),
        });

        console.log(`Embedded ${chunks.length} chunks from ${file}`);
    }

    console.log('Knowledge embedding complete!');
}

embedKnowledge().catch(console.error);
