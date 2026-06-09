import { z } from "@hono/zod-openapi";

export const adminRoleSchema = z.enum(["super_admin", "admin", "staff"]);

export const AdminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  role: adminRoleSchema,
});

export type AdminRole = z.infer<typeof adminRoleSchema>;

export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  role: AdminRole;
};
