import type { D1Store } from "@mastra/cloudflare-d1";
import type { MemoryConfig } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";

export const getMemoryFromContext = (
  requestContext: RequestContext,
  options?: MemoryConfig,
) => {
  const cachedMemory = requestContext.get("cachedMemory") as Memory | undefined;
  if (cachedMemory) {
    return cachedMemory;
  }

  const storage = requestContext.get("storage") as D1Store;
  const memory = new Memory({
    storage,
    options,
  });
  requestContext.set("cachedMemory", memory);
  return memory;
};
