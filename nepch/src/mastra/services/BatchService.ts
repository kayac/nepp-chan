import { memory } from '../memory';
import { db, connectionUrl } from '../db';
import { PersonaService } from './PersonaService';
import { google } from '@ai-sdk/google';
import { generateObject, embed } from 'ai';
import { z } from 'zod';
import { LibSQLVector } from '@mastra/libsql';
import { PersonaSchema } from '../types/PersonaSchema';

export class BatchService {
    private personaService: PersonaService;
    private model: any;
    private embeddingModel: any;
    private vectorStore: LibSQLVector;

    constructor() {
        this.personaService = new PersonaService();
        this.model = google('gemini-2.0-flash');
        this.embeddingModel = google.textEmbeddingModel('text-embedding-004');
        this.vectorStore = new LibSQLVector({
            connectionUrl: connectionUrl,
        });
    }

    async processMemoryForUser(resourceId: string = 'default-user') {
        console.log(`🚀 Starting batch memory processing for ${resourceId}...`);

        try {
            const threads = await memory.getThreadsByResourceId({ resourceId });
            console.log(`Found ${threads.length} threads for ${resourceId}`);

            if (threads.length === 0) {
                console.log('No threads found.');
                return { success: false, message: 'No threads found.' };
            }

            const results = [];

            // Ensure vector table exists (optional, but good practice if not auto-created)
            // await this.vectorStore.createIndex({ indexName: 'embeddings', dimension: 768 });

            for (const thread of threads) {
                console.log(`Processing thread: ${thread.id}`);

                const queryResult = await memory.query({ threadId: thread.id });
                const messages = queryResult.uiMessages;

                if (messages.length === 0) {
                    console.log(`No messages in thread ${thread.id}. Skipping.`);
                    continue;
                }

                // Prepare conversation text
                const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');

                // Call LLM to summarize and extract info
                console.log(`🤖 Analyzing conversation ${thread.id} with LLM...`);

                try {
                    // 2. Generate summary and extract attributes using the unified PersonaSchema
                    console.log(`🤖 Analyzing conversation ${thread.id} with LLM...`);
                    const { object } = await generateObject({
                        model: this.model,
                        schema: PersonaSchema,
                        messages: [
                            { role: 'system', content: 'Analyze the conversation and extract user persona information based on the defined schema. Be precise and infer attributes where possible.' },
                            { role: 'user', content: conversationText }
                        ],
                    });
                    console.log(`✨ Extraction complete for ${thread.id}`);

                    // 3. Update Persona in DB
                    // Map PersonaSchema fields to DB columns
                    // attributes column stores the structured persona data (User Attributes + Empathy Map)
                    const attributesToSave = {
                        age: object.age,
                        location: object.location,
                        relationship: object.relationship,
                        interestTheme: object.interestTheme,
                        emotionalState: object.emotionalState,
                        behaviorPattern: object.behaviorPattern,
                        says: object.says,
                        thinks: object.thinks,
                        does: object.does,
                        feels: object.feels
                    };

                    await this.personaService.savePersona({
                        id: thread.id, // Using threadId as villagerId for now
                        name: `Villager-${thread.id.substring(0, 4)}`, // Placeholder name
                        attributes: JSON.stringify(attributesToSave),
                        current_concerns: JSON.stringify(object.importantItems), // Store important items as current concerns
                        last_seen: new Date().toISOString(),
                        summary: `[${object.relationship}] ${object.location}在住。${object.age}。関心: ${object.interestTheme.join(', ')}`, // Construct a brief summary
                    });
                    console.log(`💾 Persona saved for ${thread.id}`);

                    // --- EMBEDDING LOGIC START ---
                    console.log(`🧠 Embedding persona for ${thread.id}...`);

                    // Create a rich text representation for embedding
                    const personaText = `
Persona ID: ${thread.id}
Attributes:
- Age: ${object.age}
- Location: ${object.location}
- Relationship: ${object.relationship}
- Interests: ${object.interestTheme.join(', ')}
- Emotion: ${object.emotionalState}
- Behavior: ${object.behaviorPattern}

Empathy Map:
- Says: ${object.says}
- Thinks: ${object.thinks}
- Does: ${object.does}
- Feels: ${object.feels}

Important Items: ${object.importantItems.join(', ')}
            `.trim();

                    const { embedding } = await embed({
                        model: this.embeddingModel,
                        value: personaText,
                    });
                    console.log(`Embedding generated. Length: ${embedding.length}`);

                    await this.vectorStore.upsert({
                        indexName: 'embeddings',
                        vectors: [embedding as any],
                        metadata: [{
                            type: 'persona',
                            thread_id: thread.id,
                            text: personaText,
                            // Store individual fields in metadata for filtering/analysis if needed
                            ...attributesToSave,
                            importantItems: object.importantItems
                        }],
                        ids: [`persona-${thread.id}`]
                    });
                    console.log(`✅ Persona embedded for ${thread.id}`);
                    // --- EMBEDDING LOGIC END ---

                    results.push({ threadId: thread.id, data: object });
                } catch (err: any) {
                    console.error(`❌ Error processing thread ${thread.id}:`, err);
                    // Continue to next thread instead of crashing
                }
            }

            console.log('✅ Batch processing complete. Personas updated.');

            // Find conversation links
            await this.findConversationLinks(threads, resourceId);

            return { success: true, message: 'Batch processing complete. Personas updated and links checked.', data: results };

        } catch (error: any) {
            console.error('❌ Batch processing failed:', error);
            return { success: false, message: `Batch processing failed: ${error.message}` };
        }
    }

    async findConversationLinks(threads: any[], resourceId: string) {
        console.log('🔗 Finding conversation links...');

        // Sort threads by date desc to get the latest one
        const sortedThreads = threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const latestThread = sortedThreads[0];
        if (!latestThread) return;

        // Get content for latest thread
        const latestThreadContent = await this.getThreadContent(latestThread.id);
        if (!latestThreadContent) return;

        console.log(`Searching for threads related to ${latestThread.id}...`);

        // Generate embedding for the latest thread content
        const { embedding } = await embed({
            model: this.embeddingModel,
            value: latestThreadContent,
        });

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            console.error('Invalid embedding generated for conversation links.');
            return;
        }

        // Perform vector search to find related messages
        const vectorString = '[' + embedding.join(',') + ']';
        const searchResult = await db.execute({
            sql: `SELECT metadata FROM memory_messages_768 ORDER BY vector_distance_cos(embedding, vector(?)) ASC LIMIT 20`,
            args: [vectorString]
        });

        // Extract unique thread IDs from search results
        const relatedThreadIds = new Set<string>();
        searchResult.rows.forEach((row: any) => {
            try {
                const metadata = JSON.parse(row.metadata as string);
                if (metadata.thread_id && metadata.thread_id !== latestThread.id) {
                    relatedThreadIds.add(metadata.thread_id);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        console.log(`Found ${relatedThreadIds.size} potentially related threads.`);

        for (const threadId of relatedThreadIds) {
            const prevThreadContent = await this.getThreadContent(threadId);
            if (!prevThreadContent) continue;

            console.log(`Comparing thread ${latestThread.id} with ${threadId}...`);

            try {
                const { object } = await generateObject({
                    model: this.model,
                    schema: z.object({
                        isRelated: z.boolean(),
                        reason: z.string().optional(),
                        confidence: z.number().min(0).max(1).optional(),
                    }),
                    messages: [
                        { role: 'system', content: 'Analyze the two conversations and determine if they are related. If they are, provide a reason and confidence score (0.0 to 1.0).' },
                        { role: 'user', content: `Conversation A (Latest):\n${latestThreadContent}\n\nConversation B (Previous):\n${prevThreadContent}` }
                    ],
                });

                if (object.isRelated && object.confidence && object.confidence > 0.6) {
                    console.log(`Found link! Reason: ${object.reason}`);
                    await db.execute({
                        sql: `INSERT INTO conversation_links (id, source_thread_id, target_thread_id, reason, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                        args: [crypto.randomUUID(), latestThread.id, threadId, object.reason || '', object.confidence, new Date().toISOString()]
                    });
                }
            } catch (e) {
                console.error(`Error comparing threads ${latestThread.id} and ${threadId}:`, e);
            }
        }
    }

    async getThreadContent(threadId: string): Promise<string | null> {
        const queryResult = await memory.query({ threadId });
        const messages = queryResult.uiMessages;
        if (messages.length === 0) return null;
        return messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    }
}

