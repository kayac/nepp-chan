import { Memory } from "@mastra/memory";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Principal, PrincipalVariables } from "~/lib/principal";
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

const resolveExpectedResourceId = async (
  principal: Principal,
  hashSecret: string,
) =>
  principal.type === "line"
    ? toLineResourceId(principal, hashSecret)
    : toResourceId(principal);

export const findOwnedThread = async (
  db: D1Database,
  threadId: string,
  principal: Principal,
  hashSecret: string,
) => {
  const storage = await getStorage(db);
  const memory = new Memory({ storage });
  const thread = await memory.getThreadById({ threadId });
  const expectedResourceId = await resolveExpectedResourceId(
    principal,
    hashSecret,
  );
  if (!thread || thread.resourceId !== expectedResourceId) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }
  return thread;
};

export const requireThreadAccess = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: PrincipalVariables & ThreadVariables;
}>(async (c, next) => {
  const principal = c.get("principal");
  if (!principal) {
    throw new HTTPException(401, { message: "認証が必要です" });
  }

  const threadId = c.req.param("threadId");
  if (!threadId) {
    throw new HTTPException(400, { message: "threadId が必要です" });
  }

  const thread = await findOwnedThread(
    c.env.DB,
    threadId,
    principal,
    c.env.RESOURCE_ID_HASH_SECRET,
  );

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
