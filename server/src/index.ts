import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import * as Sentry from "@sentry/cloudflare";
import { handleLineEvent, handleR2Event, handleScheduled } from "~/handlers";
import type { R2EventMessage } from "~/handlers/r2-event-handler";
import { logger } from "~/lib/logger";
import { getSentryOptions } from "~/lib/sentry";
import { corsMiddleware, errorHandler, securityHeaders } from "~/middleware";
import {
  authRoutes,
  broadcastAdminRoutes,
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
import type { LineEventMessage } from "~/schemas/line-schema";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);
app.use("*", securityHeaders);

app.onError(errorHandler);

app.route("/health", healthRoutes);
app.route("/chat", chatRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/threads", threadsRoutes);
app.route("/admin/broadcast", broadcastAdminRoutes);
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

const handler: ExportedHandler<CloudflareBindings> = {
  fetch: app.fetch,
  queue: async (batch, env) => {
    if (batch.queue.startsWith("nepp-chan-line-queue")) {
      return handleLineEvent(batch as MessageBatch<LineEventMessage>, env);
    }
    if (batch.queue.startsWith("nepp-chan-knowledge-sync")) {
      return handleR2Event(batch as MessageBatch<R2EventMessage>, env);
    }
    logger.error(`Unknown queue: ${batch.queue}`);
  },
  scheduled: handleScheduled,
};

export default Sentry.withSentry<CloudflareBindings>(
  (env) => getSentryOptions(env),
  handler,
);
