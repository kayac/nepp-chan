import { D1Store } from "@mastra/cloudflare-d1";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { createMastra } from "./mastra";
import { createRequestContext } from "./mastra/runtime-context";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/message", (c) => {
  return c.text("Hello Hono!");
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
