import { AuthProvider } from "~/app/dashboard/contexts/AuthContext";
import { RootLayout } from "~/components/RootLayout";
import { QueryProvider } from "~/providers/QueryProvider";
import { App } from "./App";

export const DashboardPage = () => (
  <RootLayout>
    <QueryProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryProvider>
  </RootLayout>
);
