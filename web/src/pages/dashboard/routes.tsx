import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { App } from "./App";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

type AuthContext = {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
};

type RouterContext = {
  auth: AuthContext;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/register",
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || undefined,
  }),
  component: RegisterPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: ({ context }) => {
    if (context.auth.isLoading) {
      return;
    }
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard/login" });
    }
  },
  component: App,
});

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  dashboardRoute,
  catchAllRoute,
]);

export const createAppRouter = (authContext: AuthContext) =>
  createRouter({
    routeTree,
    context: { auth: authContext },
    defaultPendingComponent: () => (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">読み込み中...</div>
      </div>
    ),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
