import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { handleLineEvent, handleR2Event, handleScheduled } from "~/handlers";
import type { R2EventMessage } from "~/handlers/r2-event-handler";
import { logger } from "~/lib/logger";
import {
  corsMiddleware,
  errorHandler,
  resolvePrincipal,
  securityHeaders,
} from "~/middleware";
import {
  authRoutes,
  broadcastAdminRoutes,
  broadcastMediaRoutes,
  emergencyAdminRoutes,
  feedbackAdminRoutes,
  feedbackRoutes,
  healthRoutes,
  invitationRoutes,
  knowledgeAdminRoutes,
  lineRoutes,
  personaAdminRoutes,
  pollAdminRoutes,
  pollRoutes,
  simpleChatRoutes,
  threadsRoutes,
} from "~/routes";
import type { LineEventMessage } from "~/schemas/line-schema";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);
app.use("*", securityHeaders);
app.use("*", resolvePrincipal);

app.onError(errorHandler);

app.route("/health", healthRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/simple-chat", simpleChatRoutes);
app.route("/threads", threadsRoutes);
app.route("/admin/broadcast", broadcastAdminRoutes);
app.route("/broadcast/media", broadcastMediaRoutes);
app.route("/admin/feedback", feedbackAdminRoutes);
app.route("/admin/knowledge", knowledgeAdminRoutes);
app.route("/admin/persona", personaAdminRoutes);
app.route("/admin/emergency", emergencyAdminRoutes);
app.route("/admin/invitations", invitationRoutes);
app.route("/admin/polls", pollAdminRoutes);
app.route("/polls", pollRoutes);
app.route("/auth", authRoutes);
app.route("/line", lineRoutes);

app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "nepp-chan API",
    version: "1.0.0",
    description: "nepp-chan バックエンド API",
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

export default handler;
