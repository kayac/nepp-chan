import { memory } from '../src/mastra/memory';

async function main() {
    const threadId = 'test-thread-1';
    console.log(`Fetching thread ${threadId}...`);
    const thread = await memory.getThreadById({ threadId });
    console.log('Thread:', JSON.stringify(thread, null, 2));

    if (thread && (thread as any).messageIds) {
        console.log('Thread has messageIds:', (thread as any).messageIds.length);
    } else {
        console.log('Thread does NOT have messageIds');
    }
}

main().catch(console.error);
