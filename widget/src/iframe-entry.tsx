import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAnalytics } from "./analytics";
import { ENVIRONMENT } from "./environment";
import { resolveSiteHost } from "./site-host";
import "./iframe.css";
import { WidgetChat } from "./WidgetChat";

initAnalytics(ENVIRONMENT.gaMeasurementId);

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <WidgetChat
      apiUrl={ENVIRONMENT.api}
      webUrl={ENVIRONMENT.web}
      siteHost={resolveSiteHost(location.search)}
    />
  </StrictMode>,
);
