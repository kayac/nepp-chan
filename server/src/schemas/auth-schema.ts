import { z } from "@hono/zod-openapi";

export const adminRoleSchema = z.enum(["super_admin", "admin", "staff"]);

export const AdminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  role: adminRoleSchema,
});

// 内部用: JWT から来る role は string のため、ランタイムでは AdminUserSchema.parse() を通さない限り保証されない
export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  role: string;
};
