import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { D1Store } from "@mastra/cloudflare-d1";
import { stream } from "hono/streaming";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/runtime-context";

// Request Schema
const WeatherQuerySchema = z.object({
  city: z.string().optional().default("tokyo"),
});

export const weatherRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const weatherRoute = createRoute({
  method: "get",
  path: "/weather",
  summary: "天気情報を取得",
  description: "指定した都市の天気情報をワークフロー経由でストリーミング取得",
  tags: ["Weather"],
  request: {
    query: WeatherQuerySchema,
  },
  responses: {
    200: {
      description:
        "天気情報のストリーミングレスポンス（WorkflowStreamEvent の JSON Lines）",
      content: {
        "text/event-stream": {
          schema: z.unknown(),
        },
      },
    },
  },
});

weatherRoutes.openapi(weatherRoute, async (c) => {
  const { city } = c.req.valid("query");

  const storage = new D1Store({ id: "mastra-storage", binding: c.env.DB });
  const mastra = createMastra(storage);
  const requestContext = createRequestContext({ storage });

  const run = await mastra.getWorkflow("weatherWorkflow").createRun();

  const workflowStream = run.stream({
    inputData: { city },
    requestContext,
  });

  return stream(c, async (s) => {
    for await (const chunk of workflowStream) {
      console.log("Sending chunk:", chunk);
      await s.write(JSON.stringify(chunk));
    }
  });
});
