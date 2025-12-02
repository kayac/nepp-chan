import { memory } from '../mastra/memory';

async function main() {
    const resourceId = 'default-user';
    console.log(`Fetching threads for ${resourceId}...`);

    const threads = await memory.getThreadsByResourceId({ resourceId });
    console.log(`Found ${threads.length} threads.`);

    for (const thread of threads) {
        try {
            const result = await memory.query({ threadId: thread.id });
            const messages = result.uiMessages;
            if (messages.length === 0) {
                console.log(`Deleting empty thread: ${thread.id} (${thread.title})`);
                // Note: memory.deleteThread might not exist or be exposed directly in this version.
                // If not, we might just have to leave them or use a direct DB call if possible.
                // Let's check if deleteThread exists in memory instance.
                if ('deleteThread' in memory) {
                    await (memory as any).deleteThread({ threadId: thread.id });
                    console.log('Deleted.');
                } else {
                    console.log('deleteThread method not found on memory instance.');
                }
            }
        } catch (e: any) {
            console.error(`Error processing thread ${thread.id}: ${e.message}`);
        }
    }
}

main();
