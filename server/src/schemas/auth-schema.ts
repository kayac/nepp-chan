import { z } from "@hono/zod-openapi";

export const AdminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  role: z.string(),
});

export type AuthUser = z.infer<typeof AdminUserSchema>;
