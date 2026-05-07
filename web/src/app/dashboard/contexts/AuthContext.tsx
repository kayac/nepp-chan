import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext } from "react";

import { useAdminUser } from "~/hooks/useAdminUser";
import { type AdminUser, postLogout } from "~/lib/api/auth";
import { adminUserKeys } from "~/lib/api/keys";
import { removeAuthToken } from "~/lib/auth-token";

type AuthContextType = {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminUser();
  const user = data ?? null;

  const logout = useCallback(async () => {
    try {
      await postLogout();
    } finally {
      removeAuthToken();
      queryClient.setQueryData(adminUserKeys.current, null);
    }
  }, [queryClient]);

  if (isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
