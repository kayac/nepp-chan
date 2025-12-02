import { memory } from '../mastra/memory';

async function main() {
    const threadId = 'test-memory-' + Date.now();
    const resourceId = 'default-user';

    try {
        console.log('1. Saving thread...');
        await memory.saveThread({
            thread: {
                id: threadId,
                resourceId,
                title: 'Memory Test',
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        console.log('2. Adding messages...');
        await memory.rememberMessages({
            messages: [
                {
                    id: 'msg-1',
                    role: 'user',
                    content: 'こんにちは。私は音威子府村の高校生で、名前はタナカです。',
                    createdAt: new Date()
                },
                {
                    id: 'msg-2',
                    role: 'assistant',
                    content: 'こんにちは、タナカさん！音威子府村の高校生なんですね。',
                    createdAt: new Date()
                }
            ],
            threadId,
            resourceId
        });

        console.log('3. Forcing Working Memory Update...');
        // updateWorkingMemory might need specific args or just threadId
        // Checking signature from inspect-memory output: updateWorkingMemory
        // It likely takes { threadId, resourceId } or similar.
        // Let's try passing the context.
        await memory.updateWorkingMemory({ threadId, resourceId });

        console.log('4. Fetching Working Memory...');
        const wm = await memory.getWorkingMemory({ threadId, resourceId });
        console.log('Working Memory Result:\n', wm);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
