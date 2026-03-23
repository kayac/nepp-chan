import { RootLayout } from "~/components/RootLayout";
import { QueryProvider } from "~/providers/QueryProvider";
import { ChatPage } from "./ChatPage";

export const App = () => (
  <RootLayout>
    <QueryProvider>
      <ChatPage />
    </QueryProvider>
  </RootLayout>
);
