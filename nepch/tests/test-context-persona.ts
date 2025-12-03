import { personaRecall } from '../src/mastra/tools/persona-recall';
import { personaRecord } from '../src/mastra/tools/persona-record';

async function testContextPersona() {
    console.log('Testing Context-Aware Persona System...');

    const testUserId = 'test-user-context-' + Date.now();
    const testName = 'Ramen Lover';
    const testLocation = 'Sapporo';

    // 1. Record a new persona with specific features
    console.log('\n1. Recording Persona (Context: Sapporo, Ramen)...');
    await personaRecord.execute({
        context: {
            userId: testUserId,
            data: {
                name: testName,
                attributes: { location: testLocation, hobby: 'eating ramen' },
                summary: 'A visitor from Sapporo who loves ramen.'
            }
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });

    // 2. Recall using relevant keywords
    console.log('\n2. Recalling with keywords "Sapporo"...');
    const recallResult1 = await personaRecall.execute({
        context: {
            query: 'Sapporo'
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Recall Result (Sapporo):', JSON.stringify(recallResult1, null, 2));

    // 3. Recall using other relevant keywords
    console.log('\n3. Recalling with keywords "ramen"...');
    const recallResult2 = await personaRecall.execute({
        context: {
            query: 'ramen'
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Recall Result (ramen):', JSON.stringify(recallResult2, null, 2));

    // 4. Recall using irrelevant keywords
    console.log('\n4. Recalling with irrelevant keywords "Tokyo"...');
    const recallResult3 = await personaRecall.execute({
        context: {
            query: 'Tokyo'
        },
        suspend: async () => { },
        runtimeContext: undefined as any
    });
    console.log('Recall Result (Tokyo):', JSON.stringify(recallResult3, null, 2));
}

testContextPersona();
