import { MiniChat } from "@nepp-chan/shared/components/MiniChat";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./iframe.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <MiniChat
      apiUrl={import.meta.env.VITE_API_URL}
      webUrl={import.meta.env.VITE_WEB_URL}
    />
  </StrictMode>,
);
