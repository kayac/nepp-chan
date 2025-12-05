import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { nepChan } from './mastra/agents/nep-chan';
import { memory } from './mastra/memory';
import { requestContext } from './context';
import { BatchService } from './mastra/services/BatchService';

import { InitService } from './mastra/services/InitService';
import { SystemService } from './mastra/services/SystemService';

const app = new Hono();
const batchService = new BatchService();
const initService = new InitService();
const systemService = new SystemService();

app.use('*', logger());
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
            console.log('Stream result:', JSON.stringify(result, null, 2));

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

            // Handle Rate Limit (429)
            if (error.statusCode === 429 || error.message?.includes('Quota exceeded') || error.message?.includes('429')) {
                const match = error.message?.match(/Please retry in ([0-9.]+)s/);
                const retryAfter = match ? match[1] : null;
                return c.json({
                    error: 'Gemini API Rate limit exceeded',
                    retryAfter: retryAfter,
                    message: error.message
                }, 429);
            }

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

app.post('/api/batch/memory', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({})); // Handle empty body
        const resourceId = body.resourceId || 'default-user';
        console.log(`Triggering batch memory processing for ${resourceId}`);
        const result = await batchService.processMemoryForUser(resourceId);
        return c.json(result);
    } catch (error: any) {
        console.error('Batch processing error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Init Service Endpoints
app.post('/api/system/init/db', async (c) => {
    const result = await initService.initializeDatabase();
    return c.json(result);
});

app.post('/api/system/init/embeddings', async (c) => {
    const result = await initService.generateEmbeddings();
    return c.json(result);
});

app.get('/api/system/env', async (c) => {
    const result = await initService.checkEnvironment();
    return c.json(result);
});

// System Service Endpoints
app.get('/api/system/check/vector', async (c) => {
    const result = await systemService.checkVectorSearch();
    return c.json(result);
});

app.get('/api/system/check/tools', async (c) => {
    const result = await systemService.checkToolRegistration();
    return c.json(result);
});

app.post('/api/system/cleanup/threads', async (c) => {
    const result = await systemService.cleanupOldThreads();
    return c.json(result);
});

const port = Number(process.env.APP_PORT) || 4112;
console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
