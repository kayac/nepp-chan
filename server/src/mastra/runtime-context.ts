import { RequestContext } from "@mastra/core/request-context";
import type { MastraStorage } from "@mastra/core/storage";

export type MastraRequestContextType = {
  storage: MastraStorage;
  db: D1Database;
};

export type MastraRequestContext = RequestContext<MastraRequestContextType>;

export const createRequestContext = (
  values: MastraRequestContextType,
): MastraRequestContext => {
  const requestContext = new RequestContext<MastraRequestContextType>();
  requestContext.set("storage", values.storage);
  requestContext.set("db", values.db);
  return requestContext;
};
