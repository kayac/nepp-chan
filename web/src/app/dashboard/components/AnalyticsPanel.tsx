import { ConversationSection } from "./analytics/ConversationSection";
import { PersonaSection } from "./analytics/PersonaSection";
import { ReportsSection } from "./analytics/ReportsSection";
import { UsageSection } from "./analytics/UsageSection";

export const AnalyticsPanel = () => (
  <div className="space-y-6">
    <ConversationSection />
    <UsageSection />
    <PersonaSection />
    <ReportsSection />
  </div>
);
