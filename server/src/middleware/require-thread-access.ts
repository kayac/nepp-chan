import { Memory } from "@mastra/memory";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { PrincipalVariables } from "~/lib/principal";
import { toLineResourceId, toResourceId } from "~/lib/principal";
import { getStorage } from "~/lib/storage";

export type ThreadVariables = {
  thread: {
    id: string;
    resourceId: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, unknown> | null;
  };
};

export const requireThreadAccess = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables> & Partial<ThreadVariables>;
}>(async (c, next) => {
  const principal = c.get("principal");
  if (!principal) {
    throw new HTTPException(401, { message: "認証が必要です" });
  }

  const threadId = c.req.param("threadId");
  if (!threadId) {
    throw new HTTPException(400, { message: "threadId が必要です" });
  }

  const storage = await getStorage(c.env.DB);
  const memory = new Memory({ storage });
  const thread = await memory.getThreadById({ threadId });

  if (!thread) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }

  const expectedResourceId =
    principal.type === "line"
      ? await toLineResourceId(principal, c.env.RESOURCE_ID_HASH_SECRET)
      : toResourceId(principal);
  if (thread.resourceId !== expectedResourceId) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }

  c.set("thread", {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata ?? null,
  });

  await next();
});
