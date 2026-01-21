import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { type AdminUser, fetchCurrentUser, postLogout } from "~/lib/api/auth";

type AuthState = {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextType = AuthState & {
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AdminUser | null) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      if (user) {
        setState({ user, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error("認証チェック失敗:", error);
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await postLogout();
    } finally {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const setUser = useCallback((user: AdminUser | null) => {
    setState({
      user,
      isLoading: false,
      isAuthenticated: user !== null,
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (state.isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ ...state, checkAuth, logout, setUser }}>
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
