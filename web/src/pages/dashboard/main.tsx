import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";

import "~/index.css";
import { QueryProvider } from "~/providers/QueryProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { createAppRouter } from "./routes";

const RouterWithAuth = () => {
  const auth = useAuth();

  const router = useMemo(
    () =>
      createAppRouter({
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        checkAuth: auth.checkAuth,
        setUser: auth.setUser,
      }),
    [auth.isAuthenticated, auth.isLoading, auth.checkAuth, auth.setUser],
  );

  return <RouterProvider router={router} />;
};

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <QueryProvider>
      <AuthProvider>
        <RouterWithAuth />
      </AuthProvider>
    </QueryProvider>
  </StrictMode>,
);
