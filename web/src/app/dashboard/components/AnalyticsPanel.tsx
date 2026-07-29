import { ConversationSection } from "./analytics/ConversationSection";
import { OntologySection } from "./analytics/OntologySection";
import { PersonaSection } from "./analytics/PersonaSection";
import { ReportsSection } from "./analytics/ReportsSection";

const TimeAxisHeading = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="pt-2">
    <h3 className="text-lg font-bold text-(--fg-1)">{title}</h3>
    <p className="text-xs text-(--fg-3) mt-0.5">{description}</p>
  </div>
);

export const AnalyticsPanel = () => (
  <div className="space-y-6">
    <TimeAxisHeading
      title="今週のできごと"
      description="週ごとのまとめ・毎週火曜に自動生成"
    />
    <ReportsSection />

    <TimeAxisHeading title="最近の動き" description="直近30日の生データ" />
    <ConversationSection />

    <TimeAxisHeading
      title="村の全体像"
      description="これまでの会話全体から見えるもの"
    />
    <PersonaSection />
    <OntologySection />
  </div>
);
