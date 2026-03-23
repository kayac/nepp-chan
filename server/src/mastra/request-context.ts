import type { D1Store } from "@mastra/cloudflare-d1";
import { RequestContext } from "@mastra/core/request-context";

import type { AuthUser } from "~/schemas/auth-schema";

export type MastraRequestContextType = {
  storage: D1Store;
  db: D1Database;
  env: CloudflareBindings;
  conversationEndedAt?: string;
  adminUser?: AuthUser;
};

export const createRequestContext = (values: MastraRequestContextType) => {
  const requestContext = new RequestContext();
  requestContext.set("storage", values.storage);
  requestContext.set("db", values.db);
  requestContext.set("env", values.env);
  if (values.conversationEndedAt) {
    requestContext.set("conversationEndedAt", values.conversationEndedAt);
  }
  if (values.adminUser) {
    requestContext.set("adminUser", values.adminUser);
  }
  return requestContext;
};
