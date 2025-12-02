import { memory } from '../mastra/memory';

async function main() {
    try {
        const threadId = 'test-thread-' + Date.now();
        const resourceId = 'default-user';

        console.log('Saving dummy thread...');
        await memory.saveThread({
            thread: {
                id: threadId,
                resourceId,
                title: 'Test Thread',
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        console.log('Fetching thread by ID...');
        const thread = await memory.getThreadById({ threadId });
        console.log('Thread:', thread);

        console.log('Fetching messages via query...');
        // @ts-ignore
        const queryResult = await memory.query({ threadId });
        console.log('Query Result:', queryResult);

        console.log('Fetching threads by resource ID...');
        const threads = await memory.getThreadsByResourceId({ resourceId });
        console.log('Threads list:', threads);

    } catch (e) {
        console.log('Error:', e);
    }
}

main();
