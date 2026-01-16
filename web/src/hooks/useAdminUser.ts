import { useQuery } from "@tanstack/react-query";

import { type AdminUser, fetchCurrentUser } from "~/lib/api/auth";

export const adminUserKeys = {
  current: ["adminUser", "current"] as const,
};

export const useAdminUser = () =>
  useQuery<AdminUser | null>({
    queryKey: adminUserKeys.current,
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5分間はキャッシュを使用
    retry: false,
  });
