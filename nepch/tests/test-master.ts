import { masterTool } from '../src/mastra/tools/master-tool';

async function testMaster() {
    console.log('Testing masterTool...');
    const result = await masterTool.execute({
        context: {
            password: 'admin', // Default password in code
            query: '音威子府',
        },
        runId: 'test-run',
        suspend: async () => { },
    });
    console.log('Result:', JSON.stringify(result, null, 2));
}

testMaster();
