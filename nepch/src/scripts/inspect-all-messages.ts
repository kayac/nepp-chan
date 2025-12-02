import { memory } from '../mastra/memory';

async function main() {
    const resourceId = 'default-user';
    console.log(`Fetching threads for ${resourceId}...`);

    const threads = await memory.getThreadsByResourceId({ resourceId });
    console.log(`Found ${threads.length} threads.`);

    for (const thread of threads) {
        console.log(`\nThread: ${thread.id} (${thread.title})`);
        try {
            const result = await memory.query({ threadId: thread.id });
            const messages = result.uiMessages;
            console.log(`  Messages: ${messages.length}`);
            if (messages.length > 0) {
                console.log(`  First message: ${JSON.stringify(messages[0]).substring(0, 100)}...`);
            }
        } catch (e: any) {
            console.error(`  Error fetching messages: ${e.message}`);
        }
    }
}

main();
