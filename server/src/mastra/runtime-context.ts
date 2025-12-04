import { RequestContext } from "@mastra/core/request-context";
import type { MastraStorage } from "@mastra/core/storage";

export type MastraRequestContextType = {
  storage: MastraStorage;
};

export type MastraRequestContext = RequestContext<MastraRequestContextType>;

export const createRequestContext = (
  values: MastraRequestContextType,
): MastraRequestContext => {
  const requestContext = new RequestContext<MastraRequestContextType>();
  requestContext.set("storage", values.storage);
  return requestContext;
};
