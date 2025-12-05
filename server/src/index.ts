import { D1Store } from "@mastra/cloudflare-d1";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/runtime-context";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

app.post("/chat", async (c) => {
  const { message, resourceId, threadId } = await c.req.json<{
    message: string;
    resourceId?: string;
    threadId?: string;
  }>();

  const storage = new D1Store({ id: "mastra-storage", binding: c.env.DB });
  const mastra = createMastra(storage);
  const requestContext = createRequestContext({ storage });

  const agent = mastra.getAgent("weatherAgent");
  const response = await agent.stream(message, {
    resourceId: resourceId ?? "default-user",
    threadId: threadId ?? crypto.randomUUID(),
    requestContext,
  });

  return stream(c, async (stream) => {
    for await (const chunk of response.textStream) {
      await stream.write(chunk);
    }
  });
});

app.get("/weather", async (c) => {
  const storage = new D1Store({ id: "mastra-storage", binding: c.env.DB });
  const mastra = createMastra(storage);
  const requestContext = createRequestContext({ storage });

  const run = await mastra.getWorkflow("weatherWorkflow").createRun();

  const workflowStream = run.stream({
    inputData: { city: "tokyo" },
    requestContext,
  });

  return stream(c, async (stream) => {
    for await (const chunk of workflowStream) {
      console.log("Sending chunk:", chunk);
      await stream.write(JSON.stringify(chunk));
    }
  });
});

export default app;
