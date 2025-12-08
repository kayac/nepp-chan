import { Hono } from 'hono';
import { db } from './mastra/db';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { nepChan } from './mastra/agents/nep-chan';
import { memory, storage } from './mastra/memory';
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
                memory: {
                    thread: threadId,
                    resource: resourceId,
                },
            });

            if ((result as any).fullStream) {
                const stream = (result as any).fullStream as ReadableStream;

                const transformer = new TransformStream({
                    transform(chunk, controller) {
                        if (chunk.type === 'text-delta') {
                            const text = chunk.payload?.text || chunk.payload;
                            if (typeof text === 'string') {
                                // App.tsx expects SSE format: data: {"type": "text-delta", "delta": "..."}\n\n
                                const event = {
                                    type: 'text-delta',
                                    delta: text
                                };
                                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
                            }
                        } else if (chunk.type === 'tool-call') {
                            // Handle tool calls if needed, but for now text is priority
                            // App.tsx expects: type: 'tool-input-available', toolName, toolCallId, input
                            const payload = chunk.payload;
                            if (payload) {
                                const event = {
                                    type: 'tool-input-available',
                                    toolName: payload.toolName,
                                    toolCallId: payload.toolCallId,
                                    input: payload.args
                                };
                                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
                            }
                        } else if (chunk.type === 'tool-result') {
                            // App.tsx expects: type: 'tool-output-available', toolCallId, output
                            const payload = chunk.payload;
                            if (payload) {
                                const event = {
                                    type: 'tool-output-available',
                                    toolCallId: payload.toolCallId,
                                    output: payload.result
                                };
                                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
                            }
                        }
                    }
                });

                return new Response(stream.pipeThrough(transformer), {
                    headers: {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    }
                });
            }

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
            console.error('Stream error stack:', error.stack);

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
        const { threads } = await memory.listThreadsByResourceId({ resourceId });

        // In Mastra 1.0, threads don't have messageIds, so we can't easily filter empty ones without N+1 queries.
        // For now, return all threads.
        console.log(`Found ${threads.length} threads`);
        return c.json(threads);
    } catch (error: any) {
        console.error('Error fetching threads:', error);
        return c.json({ error: error.message }, 500);
    }
});

app.get('/api/threads/:threadId/messages', async (c) => {
    const threadId = c.req.param('threadId');
    console.log(`Fetching messages for ${threadId}`);
    try {
        // Check if thread exists
        const thread = await memory.getThreadById({ threadId });
        if (!thread) {
            return c.json([]);
        }

        // Fetch message IDs from DB directly since they are not on the thread object
        const result = await db.execute({
            sql: 'SELECT id FROM mastra_messages WHERE thread_id = ? ORDER BY createdAt ASC',
            args: [threadId]
        });

        const messageIds = result.rows.map((row: any) => row.id);

        if (messageIds.length === 0) {
            return c.json([]);
        }

        const { messages } = await storage.listMessagesById({ messageIds });
        console.log(`Found ${messages.length} messages`);

        // Sort messages by createdAt just in case
        messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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

import { exec } from 'child_process';

app.post('/api/test/run', async (c) => {
    const { count } = await c.req.json();
    const testLimit = count || 1;
    console.log(`Triggering E2E test with limit: ${testLimit}`);

    // Run in background
    exec(`TEST_LIMIT=${testLimit} bun run test:e2e:limit`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Test execution error: ${error}`);
            return;
        }
        console.log(`Test stdout: ${stdout}`);
        console.error(`Test stderr: ${stderr}`);
    });

    return c.json({ success: true, message: `Started E2E test for ${testLimit} characters` });
});

const port = Number(process.env.APP_PORT) || 4112;
console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
