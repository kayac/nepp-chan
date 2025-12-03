
import { nepChan } from '../mastra/agents/nep-chan';

async function verifyPriority() {
    console.log('Checking Env Vars...');
    console.log('GOOGLE_GENERATIVE_AI_API_KEY exists:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

    const scenarios = [
        { query: 'クマが出た！助けて！', expectedTool: 'emergencyReport' },
        { query: '/master admin test', expectedTool: 'masterTool' },
        { query: '私のこと覚えてる？', expectedTool: 'persona-recall' },
        { query: '私はタナカです。', expectedTool: 'persona-record' },
        { query: '村長は誰ですか？', expectedTool: 'knowledge-tool' },
        { query: '今日の東京の天気は？', expectedTool: 'searchTool' },
        { query: '最新のニュースを追加して', expectedTool: 'news-tool' },
    ];

    console.log('Starting Tool Priority Verification...\n');

    for (const scenario of scenarios) {
        console.log(`Query: "${scenario.query}"`);
        try {
            const result = await nepChan.generate(scenario.query);
            // console.log('Full Result:', JSON.stringify(result, null, 2));

            let toolNames: string[] = [];
            if (result.steps && Array.isArray(result.steps)) {
                for (const step of result.steps) {
                    // console.log('Step:', step.type, step.toolName);
                    if (step.type === 'tool-call' && step.toolName) {
                        toolNames.push(step.toolName);
                    } else if (step.toolCalls) {
                        toolNames.push(...step.toolCalls.map((tc: any) => tc.toolName));
                    }
                }
            } else if (result.toolCalls) {
                toolNames = result.toolCalls.map(tc => tc.toolName);
            }

            console.log(`  Text Response: ${result.text}`);
            console.log(`  Tools called: ${toolNames.join(', ') || 'None'}`);

            const isMatch = toolNames.includes(scenario.expectedTool);
            if (isMatch) {
                console.log(`  ✅ Success: Expected ${scenario.expectedTool} found.`);
            } else {
                console.log(`  ❌ Failure: Expected ${scenario.expectedTool}, but got [${toolNames.join(', ')}].`);
            }
        } catch (error) {
            console.error(`  ❌ Error:`, error);
        }
        console.log('---\n');
    }
}

verifyPriority();
