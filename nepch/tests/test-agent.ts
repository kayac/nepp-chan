import { nepChan } from '../src/mastra/agents/nep-chan';

async function testAgent() {
    try {
        console.log('Testing Nep-chan agent...');
        const result = await nepChan.generate([
            { role: 'user', content: 'こんにちは' }
        ]);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error testing agent:', error);
    }
}

testAgent();
