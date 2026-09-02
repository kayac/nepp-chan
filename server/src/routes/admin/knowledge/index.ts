import { OpenAPIHono } from "@hono/zod-openapi";
import type { PrincipalVariables } from "~/lib/principal";
import { knowledgeConvertRoutes } from "./convert";
import { knowledgeFilesRoutes } from "./files";
import { knowledgeSourcesRoutes } from "./sources";
import { knowledgeSyncRoutes } from "./sync";

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

knowledgeAdminRoutes.route("/", knowledgeSyncRoutes);
knowledgeAdminRoutes.route("/", knowledgeSourcesRoutes);
knowledgeAdminRoutes.route("/", knowledgeFilesRoutes);
knowledgeAdminRoutes.route("/", knowledgeConvertRoutes);
