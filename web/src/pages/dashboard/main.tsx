import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";

import { SentryErrorBoundary } from "~/components/SentryErrorBoundary";
import "~/index.css";
import { initSentry } from "~/lib/sentry";
import { QueryProvider } from "~/providers/QueryProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { createAppRouter } from "./routes";

initSentry();

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
    <SentryErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <RouterWithAuth />
        </AuthProvider>
      </QueryProvider>
    </SentryErrorBoundary>
  </StrictMode>,
);
