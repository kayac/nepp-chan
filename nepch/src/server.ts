import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { nepChan } from './mastra/agents/nep-chan';

const app = new Hono();

app.use('/*', cors());

app.post('/api/agents/Nep-chan/stream', async (c) => {
    const { messages } = await c.req.json();

    // Mastra agent.stream returns a result that can be converted to a data stream
    // compatible with AI SDK.
    // However, Mastra's stream method might return a Mastra-specific response.
    // Let's check if we can use toDataStreamResponse from ai package if Mastra returns a CoreMessage stream.

    // nepChan.stream({ messages }) returns a Promise<MastraModelOutput> or AISDKV5OutputStream
    // Since we are using AI SDK v5 models (google/anthropic via @ai-sdk/*), it likely returns AISDKV5OutputStream.

    try {
        const result = await nepChan.stream(messages as any, {
            format: 'aisdk',
        });

        console.log('Stream result:', result);

        if (result instanceof Response || ('body' in (result as any))) {
            return result;
        }

        // If result has toUIMessageStreamResponse, use it.
        if ('toUIMessageStreamResponse' in result) {
            return (result as any).toUIMessageStreamResponse();
        }

        // Fallback if it returns a raw stream or something else.
        // But Mastra with AI SDK v5 should return a result compatible with AI SDK.
        // Let's assume it does.
        return c.json({ error: 'Unexpected response format from agent' }, 500);
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

const port = 4111;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});
