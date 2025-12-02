import { listSkillsTool, readSkillTool } from '../mastra/tools/skill-tools';

async function testSkillTools() {
    console.log('--- Testing listSkillsTool ---');
    const listResult = await listSkillsTool.execute({ context: {}, runtimeContext: undefined });
    console.log('List Result:', JSON.stringify(listResult, null, 2));

    if (listResult.skills.length > 0) {
        const skillName = 'docx';
        console.log(`\n--- Testing readSkillTool for "${skillName}" ---`);
        try {
            const readResult = await readSkillTool.execute({ context: { skillName }, runtimeContext: undefined });
            console.log('Read Result (truncated):', {
                skillName: readResult.skillName,
                content: readResult.content.substring(0, 100) + '...',
            });
        } catch (error) {
            console.error('Error reading skill:', error);
        }
    } else {
        console.warn('No skills found to test readSkillTool.');
    }
}

testSkillTools().catch(console.error);
