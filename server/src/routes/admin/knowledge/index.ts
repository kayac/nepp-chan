import { OpenAPIHono } from "@hono/zod-openapi";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAuth } from "~/middleware/auth";
import { requireRole } from "~/middleware/require-role";
import { knowledgeConvertRoutes } from "./convert";
import { knowledgeFilesRoutes } from "./files";
import { knowledgeSyncRoutes } from "./sync";

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

knowledgeAdminRoutes.use("*", requireAuth);
knowledgeAdminRoutes.use("*", requireRole("super_admin"));

knowledgeAdminRoutes.route("/", knowledgeSyncRoutes);
knowledgeAdminRoutes.route("/", knowledgeFilesRoutes);
knowledgeAdminRoutes.route("/", knowledgeConvertRoutes);
