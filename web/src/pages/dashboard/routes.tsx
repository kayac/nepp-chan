import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { App } from "./App";

type AuthContext = {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  setUser: (
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
    } | null,
  ) => void;
};

type RouterContext = {
  auth: AuthContext;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      window.location.href = "/login";
    }
  },
  component: App,
});

const routeTree = rootRoute.addChildren([dashboardRoute]);

export const createAppRouter = (authContext: AuthContext) =>
  createRouter({
    routeTree,
    context: { auth: authContext },
    defaultPendingComponent: () => (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">読み込み中...</div>
      </div>
    ),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
