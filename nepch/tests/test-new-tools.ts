import { personaRecall } from '../src/mastra/tools/persona-recall';
import { personaRecord } from '../src/mastra/tools/persona-record';
import { newsTool } from '../src/mastra/tools/news-tool';

async function testTools() {
    console.log('Testing new tools...');

    // 1. Test Persona Record (Save)
    console.log('\nTesting Persona Record (Save)...');
    const saveResult = await personaRecord.execute({
        context: {
            userId: 'test-user-1',
            data: {
                name: 'Test User',
                attributes: { age: 30, location: 'Tokyo' },
                current_concerns: { work: 'busy' },
                summary: 'A test user from Tokyo.'
            }
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Save Result:', JSON.stringify(saveResult, null, 2));

    // 2. Test Persona Recall (Get)
    console.log('\nTesting Persona Recall (Get)...');
    const getResult = await personaRecall.execute({
        context: {
            query: 'Tokyo',
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Get Result:', JSON.stringify(getResult, null, 2));

    // 3. Test News Tool (Add)
    console.log('\nTesting News Tool (Add)...');
    const addNewsResult = await newsTool.execute({
        context: {
            action: 'add',
            content: 'Village festival is coming soon!',
            category: 'NEWS',
            sourceId: 'test-user-1',
            limit: 5
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Add News Result:', JSON.stringify(addNewsResult, null, 2));

    // 4. Test News Tool (Get)
    console.log('\nTesting News Tool (Get)...');
    const getNewsResult = await newsTool.execute({
        context: {
            action: 'get',
            category: 'NEWS',
            limit: 5
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Get News Result:', JSON.stringify(getNewsResult, null, 2));
}

testTools();
