import { Hono } from "hono";
import { stream } from "hono/streaming";
import { mastra } from "./mastra";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/message", (c) => {
	return c.text("Hello Hono!");
});

app.get("/weather", async (c) => {
	const run = await mastra.getWorkflow("weatherWorkflow").createRun();

	const workflowStream = run.stream({
		inputData: { city: "tokyo" },
	});

	return stream(c, async (stream) => {
		for await (const chunk of workflowStream) {
			console.log("Sending chunk:", chunk);
			await stream.write(JSON.stringify(chunk));
		}
	});
});

export default app;
