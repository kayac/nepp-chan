import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { nepChan } from './mastra/agents/nep-chan';
import { memory } from './mastra/memory';
import { requestContext } from './context';

const app = new Hono();

app.use('/*', cors());

app.post('/api/agents/Nep-chan/stream', async (c) => {
    const { messages, threadId } = await c.req.json();
    const resourceId = 'default-user'; // Use a default resourceId for now

    return requestContext.run({ threadId, resourceId }, async () => {
        try {
            const result = await nepChan.stream(messages as any, {
                format: 'aisdk',
                threadId,
                resourceId,
            });

            console.log('Stream result keys:', Object.keys(result));

            if ('toDataStreamResponse' in result) {
                return (result as any).toDataStreamResponse();
            }

            if ('toUIMessageStreamResponse' in result) {
                return (result as any).toUIMessageStreamResponse();
            }

            if ('toTextStreamResponse' in result) {
                return (result as any).toTextStreamResponse();
            }

            return c.json({ error: 'Unexpected response format from agent' }, 500);
        } catch (error: any) {
            console.error('Stream error:', error);
            return c.json({ error: error.message }, 500);
        }
    });
});

app.get('/api/threads/:resourceId', async (c) => {
    const resourceId = c.req.param('resourceId');
    console.log(`Fetching threads for ${resourceId}`);
    try {
        const threads = await memory.getThreadsByResourceId({ resourceId });

        // Filter out threads with no messages
        const validThreads = [];
        for (const thread of threads) {
            const result = await memory.query({ threadId: thread.id });
            const messages = result.uiMessages;
            if (messages.length > 0) {
                validThreads.push(thread);
            }
        }

        console.log(`Found ${validThreads.length} valid threads (out of ${threads.length})`);
        return c.json(validThreads);
    } catch (error: any) {
        console.error('Error fetching threads:', error);
        return c.json({ error: error.message }, 500);
    }
});

app.get('/api/threads/:threadId/messages', async (c) => {
    const threadId = c.req.param('threadId');
    console.log(`Fetching messages for ${threadId}`);
    try {
        const queryResult = await memory.query({ threadId });
        const messages = queryResult.uiMessages;
        console.log(`Found ${messages.length} messages`);
        return c.json(messages);
    } catch (error: any) {
        console.error('Error fetching messages:', error);
        return c.json({ error: error.message }, 500);
    }
});

const port = 4111;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});
