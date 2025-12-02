
import { nepChan } from '../mastra/agents/nep-chan';

async function verifyFullFlow() {
    console.log('--- Starting Verification Flow ---');

    // Test 1: Search Tool
    console.log('\n[Test 1] Testing Search Tool Flow');
    const searchMessages = [
        { role: 'user', content: '音威子府村の天気を調べて' }
    ];

    try {
        const result = await nepChan.stream(searchMessages, {
            threadId: 'verify-search-thread',
            resourceId: 'verify-user',
        });

        console.log('Stream started for Search Tool');

        console.log('Result keys:', Object.keys(result));

        if ('toDataStream' in result) {
            const stream = (result as any).toDataStream();
            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                console.log('[Stream Chunk]', chunk);
            }
        } else if ('textStream' in result) {
            // Fallback for AI SDK result
            for await (const textPart of (result as any).textStream) {
                console.log('[Text Chunk]', textPart);
            }
        } else {
            console.log('Result does not have toDataStream method', result);
        }

    } catch (error) {
        console.error('[Test 1] Error:', error);
    }

    // Test 2: Master Tool
    console.log('\n[Test 2] Testing Master Tool Flow');
    const masterMessages = [
        { role: 'user', content: '/master admin 音威子府' }
    ];

    try {
        const result = await nepChan.stream(masterMessages, {
            threadId: 'verify-master-thread',
            resourceId: 'verify-user',
        });

        console.log('Stream started for Master Tool');

        if ('toDataStream' in result) {
            const stream = (result as any).toDataStream();
            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                console.log('[Stream Chunk]', chunk);
            }
        }

    } catch (error) {
        console.error('[Test 2] Error:', error);
    }
}

verifyFullFlow();
