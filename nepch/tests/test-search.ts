import { searchTool } from '../src/mastra/tools/search-tool';

async function testSearch() {
    console.log('Testing searchTool...');
    const result = await searchTool.execute({
        context: {
            query: '音威子府村 天気',
        },
        runId: 'test-run',
        suspend: async () => { },
    });
    console.log('Result:', JSON.stringify(result, null, 2));
}

testSearch();
