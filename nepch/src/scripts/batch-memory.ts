
import { memory } from '../mastra/memory';
import { PersonaService } from '../mastra/services/PersonaService';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const personaService = new PersonaService();
const model = google('gemini-2.0-flash');

async function batchProcessMemory() {
    console.log('🚀 Starting batch memory processing...');

    try {
        // In a real implementation, we would fetch active threads from the DB.
        // For now, we'll iterate through a known list or just process a specific user for demonstration.
        // Since memory.getThreadsByResourceId is available, let's use that.

        const resourceId = 'default-user'; // Target user
        const threads = await memory.getThreadsByResourceId({ resourceId });

        console.log(`Found ${threads.length} threads for ${resourceId}`);

        // Process only threads updated in the last 24 hours (mock logic for now, just taking the latest)
        const latestThread = threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

        if (!latestThread) {
            console.log('No threads found.');
            return;
        }

        console.log(`Processing latest thread: ${latestThread.id}`);

        const queryResult = await memory.query({ threadId: latestThread.id });
        const messages = queryResult.uiMessages;

        if (messages.length === 0) {
            console.log('No messages in thread.');
            return;
        }

        // Prepare conversation text
        const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        // Call LLM to summarize and extract info
        console.log('🤖 Analyzing conversation with LLM...');
        const { object } = await generateObject({
            model: model,
            schema: z.object({
                attributes: z.record(z.string()).describe('User attributes extracted from conversation (e.g., age, location, hobbies)'),
                summary: z.string().describe('Brief summary of the conversation topics'),
                interests: z.array(z.string()).describe('List of user interests mentioned'),
            }),
            messages: [
                { role: 'system', content: 'Analyze the following conversation and extract user information. Focus on attributes, interests, and a general summary.' },
                { role: 'user', content: conversationText }
            ],
        });

        console.log('✨ Extraction complete:', object);

        // Update Persona
        await personaService.updatePersonaFromSummary(resourceId, {
            attributes: object.attributes,
            current_concerns: { interests: object.interests }, // Mapping interests to concerns/interests
            summary: object.summary
        });

        console.log('✅ Batch processing complete. Persona updated.');

    } catch (error) {
        console.error('❌ Batch processing failed:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    batchProcessMemory();
}
