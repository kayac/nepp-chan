import { RootLayout } from "~/components/RootLayout";
import { QueryProvider } from "~/providers/QueryProvider";
import { App } from "./App";
import { AuthProvider } from "./contexts/AuthContext";

export const DashboardPage = () => (
  <RootLayout>
    <QueryProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryProvider>
  </RootLayout>
);
