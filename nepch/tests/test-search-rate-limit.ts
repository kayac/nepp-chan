
import { searchTool } from '../src/mastra/tools/search-tool';

// Mock global fetch
const originalFetch = global.fetch;

async function testSearchRateLimit() {
    console.log('Testing search-tool rate limit handling...');

    // Mock fetch to return 429
    global.fetch = async () => ({
        ok: false,
        status: 429,
        text: async () => 'Quota exceeded',
        json: async () => ({}),
    } as any);

    try {
        const result = await searchTool.execute({
            context: { query: 'test query' },
            mastra: {} as any
        });

        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.error === 'RATE_LIMIT_EXCEEDED' && result.source === 'Google Custom Search API') {
            console.log('✅ SUCCESS: Rate limit error correctly handled.');
        } else {
            console.error('❌ FAILURE: Unexpected result format.');
        }

    } catch (error) {
        console.error('❌ FAILURE: Tool execution threw an error:', error);
    } finally {
        // Restore fetch
        global.fetch = originalFetch;
    }
}

testSearchRateLimit();
