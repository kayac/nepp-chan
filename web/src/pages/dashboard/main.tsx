import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "~/index.css";
import { QueryProvider } from "~/providers/QueryProvider";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
