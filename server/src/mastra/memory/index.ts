import type { D1Store } from "@mastra/cloudflare-d1";
import type { MemoryConfig } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";
import { getStorage } from "~/lib/storage";
import { type Persona, personaSchema } from "~/schemas/persona-schema";

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

export const getWorkingMemoryByThread = async (
  db: D1Database,
  threadId: string,
  resourceId: string,
): Promise<Persona | null> => {
  const storage = await getStorage(db);
  const memory = new Memory({
    storage,
    options: {
      workingMemory: {
        enabled: true,
        scope: "resource",
        schema: personaSchema,
      },
    },
  });

  return (await memory.getWorkingMemory({
    threadId,
    resourceId,
  })) as Persona | null;
};
