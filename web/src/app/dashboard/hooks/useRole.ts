import { useMemo } from "react";

import type { AdminUser } from "~/lib/api/auth";

type AdminRole = AdminUser["role"];

const ROLE_LEVEL: Record<AdminRole, number> = {
  super_admin: 3,
  admin: 2,
  staff: 1,
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "スーパー管理者",
  admin: "管理者",
  staff: "職員",
};

export const useRole = (user: AdminUser | null | undefined) => {
  return useMemo(() => {
    const role = user?.role;
    const level = role ? ROLE_LEVEL[role] : 0;

    return {
      role,
      hasRole: (minRole: AdminRole) => level >= ROLE_LEVEL[minRole],
      isSuperAdmin: role === "super_admin",
    };
  }, [user?.role]);
};
