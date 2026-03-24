import { OpenAPIHono } from "@hono/zod-openapi";

import { requireAuth } from "~/middleware/auth";
import { requireRole } from "~/middleware/require-role";
import { knowledgeConvertRoutes } from "./convert";
import { knowledgeFilesRoutes } from "./files";
import { knowledgeSyncRoutes } from "./sync";

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

knowledgeAdminRoutes.use("*", requireAuth);
knowledgeAdminRoutes.use("*", requireRole("super_admin"));

knowledgeAdminRoutes.route("/", knowledgeSyncRoutes);
knowledgeAdminRoutes.route("/", knowledgeFilesRoutes);
knowledgeAdminRoutes.route("/", knowledgeConvertRoutes);
