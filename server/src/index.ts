import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { corsMiddleware, errorHandler } from "~/middleware";
import {
  chatRoutes,
  healthRoutes,
  knowledgeAdminRoutes,
  threadsRoutes,
  weatherRoutes,
} from "~/routes";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);

app.onError(errorHandler);

app.route("/health", healthRoutes);
app.route("/chat", chatRoutes);
app.route("/threads", threadsRoutes);
app.route("/weather", weatherRoutes);
app.route("/admin/knowledge", knowledgeAdminRoutes);

app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "AISS NEPCH API",
    version: "1.0.0",
    description: "AISS NEPCH バックエンド API",
  },
});

app.get("/swagger", swaggerUI({ url: "/doc" }));

export default app;
