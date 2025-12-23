import type { D1Store } from "@mastra/cloudflare-d1";
import { RequestContext } from "@mastra/core/request-context";

export type MastraRequestContextType = {
  storage: D1Store;
  db: D1Database;
  env: CloudflareBindings;
  masterPassword?: string;
  conversationEndedAt?: string;
};

export const createRequestContext = (values: MastraRequestContextType) => {
  const requestContext = new RequestContext();
  requestContext.set("storage", values.storage);
  requestContext.set("db", values.db);
  requestContext.set("env", values.env);
  if (values.masterPassword) {
    requestContext.set("masterPassword", values.masterPassword);
  }
  if (values.conversationEndedAt) {
    requestContext.set("conversationEndedAt", values.conversationEndedAt);
  }
  return requestContext;
};
