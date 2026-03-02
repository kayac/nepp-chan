import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { handleR2Event } from "~/handlers";
import { handlePersonaExtract } from "~/handlers/persona-extract-handler";
import { corsMiddleware, errorHandler, securityHeaders } from "~/middleware";
import {
  authRoutes,
  chatRoutes,
  emergencyAdminRoutes,
  feedbackAdminRoutes,
  feedbackRoutes,
  healthRoutes,
  invitationRoutes,
  knowledgeAdminRoutes,
  lineRoutes,
  personaAdminRoutes,
  threadsRoutes,
} from "~/routes";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);
app.use("*", securityHeaders);

app.onError(errorHandler);

app.route("/health", healthRoutes);
app.route("/chat", chatRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/threads", threadsRoutes);
app.route("/admin/feedback", feedbackAdminRoutes);
app.route("/admin/knowledge", knowledgeAdminRoutes);
app.route("/admin/persona", personaAdminRoutes);
app.route("/admin/emergency", emergencyAdminRoutes);
app.route("/admin/invitations", invitationRoutes);
app.route("/auth", authRoutes);
app.route("/line", lineRoutes);

app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "AISS NEPPCHAN API",
    version: "1.0.0",
    description: "AISS NEPPCHAN バックエンド API",
  },
});

app.get("/swagger", swaggerUI({ url: "/doc" }));

export default {
  fetch: app.fetch,
  queue: handleR2Event,
  scheduled: handlePersonaExtract,
};
