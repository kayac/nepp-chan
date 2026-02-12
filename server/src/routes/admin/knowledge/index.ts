import { OpenAPIHono } from "@hono/zod-openapi";

import { sessionAuth } from "~/middleware/session-auth";
import { knowledgeConvertRoutes } from "./convert";
import { knowledgeFilesRoutes } from "./files";
import { knowledgeSyncRoutes } from "./sync";

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

knowledgeAdminRoutes.use("*", sessionAuth);

knowledgeAdminRoutes.route("/", knowledgeSyncRoutes);
knowledgeAdminRoutes.route("/", knowledgeFilesRoutes);
knowledgeAdminRoutes.route("/", knowledgeConvertRoutes);
