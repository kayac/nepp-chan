import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import * as Sentry from "@sentry/cloudflare";
import { handleLineEvent, handleR2Event, handleScheduled } from "~/handlers";
import type { R2EventMessage } from "~/handlers/r2-event-handler";
import { logger } from "~/lib/logger";
import { getSentryOptions } from "~/lib/sentry";
import {
  corsMiddleware,
  errorHandler,
  resolvePrincipal,
  securityHeaders,
} from "~/middleware";
import {
  analyticsAdminRoutes,
  authRoutes,
  broadcastAdminRoutes,
  broadcastMediaRoutes,
  correctionsAdminRoutes,
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
  reviewAdminRoutes,
  threadsRoutes,
  twilioVoiceRoutes,
  userAdminRoutes,
  widgetSiteAdminRoutes,
} from "~/routes";
import type { LineEventMessage } from "~/schemas/line-schema";
import { CallBridge, handleRelayUpgrade } from "~/services/voice/call-bridge";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);
app.use("*", securityHeaders);
app.use("*", resolvePrincipal);

app.onError(errorHandler);

app.route("/health", healthRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/threads", threadsRoutes);
app.route("/admin/analytics", analyticsAdminRoutes);
app.route("/admin/broadcast", broadcastAdminRoutes);
app.route("/broadcast/media", broadcastMediaRoutes);
app.route("/admin/feedback", feedbackAdminRoutes);
app.route("/admin/knowledge", knowledgeAdminRoutes);
app.route("/admin/persona", personaAdminRoutes);
app.route("/admin/review", reviewAdminRoutes);
app.route("/admin/corrections", correctionsAdminRoutes);
app.route("/admin/emergency", emergencyAdminRoutes);
app.route("/admin/invitations", invitationRoutes);
app.route("/admin/users", userAdminRoutes);
app.route("/admin/polls", pollAdminRoutes);
app.route("/admin/widget-sites", widgetSiteAdminRoutes);
app.route("/polls", pollRoutes);
app.route("/auth", authRoutes);
app.route("/line", lineRoutes);
app.route("/twilio/voice", twilioVoiceRoutes);

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
  fetch: (request, env, ctx) => {
    const url = new URL(request.url);
    if (
      url.pathname === "/twilio/voice/relay" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      return handleRelayUpgrade(request, env);
    }
    return app.fetch(request, env, ctx);
  },
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

export { CallBridge };

export default Sentry.withSentry<CloudflareBindings>(
  (env) => getSentryOptions(env),
  handler,
);
