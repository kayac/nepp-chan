import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./iframe.css";
import { WidgetChat } from "./WidgetChat";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <WidgetChat
      apiUrl={import.meta.env.VITE_API_URL}
      webUrl={import.meta.env.VITE_WEB_URL}
    />
  </StrictMode>,
);
