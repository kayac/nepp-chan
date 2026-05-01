import { type ReactNode, StrictMode } from "react";

export const RootLayout = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);
