import { useEffect } from "react";
import { AudienceSection } from "./analytics/AudienceSection";
import { ConversationSection } from "./analytics/ConversationSection";
import { OntologySection } from "./analytics/OntologySection";
import { PersonaSection } from "./analytics/PersonaSection";
import { ReportsSection } from "./analytics/ReportsSection";
import type { VoiceFilter } from "./voices/helpers";

export type AnalyticsSection = "conversation" | "audience" | "overview";

interface Props {
  onAskMayor?: (context: string) => void;
  onShowVoices?: (filter: Partial<VoiceFilter>) => void;
  initialSection?: AnalyticsSection;
}

const TimeAxisHeading = ({
  title,
  description,
  askContext,
  onAskMayor,
}: {
  title: string;
  description: string;
  askContext: string;
  onAskMayor?: (context: string) => void;
}) => (
  <div className="pt-2 flex items-end justify-between gap-2">
    <div>
      <h3 className="text-lg font-bold text-(--fg-1)">{title}</h3>
      <p className="text-xs text-(--fg-3) mt-0.5">{description}</p>
    </div>
    {onAskMayor && (
      <button
        type="button"
        onClick={() => onAskMayor(askContext)}
        className="shrink-0 px-3 py-1.5 rounded-(--r-pill) bg-(--brand-soft) text-sm font-medium text-(--fg-1) hover:bg-(--brand-soft-2) transition-colors"
      >
        💬 聞く
      </button>
    )}
  </div>
);

export const AnalyticsPanel = ({
  onAskMayor,
  onShowVoices,
  initialSection,
}: Props) => {
  useEffect(() => {
    if (!initialSection) return;
    document
      .getElementById(`analytics-${initialSection}`)
      ?.scrollIntoView({ block: "start" });
  }, [initialSection]);

  return (
    <div className="space-y-6">
      <div id="analytics-conversation" className="space-y-6">
        <TimeAxisHeading
          title="最近の動き"
          description="直近30日の会話の量と時間帯、どこから来たか"
          askContext="直近30日の会話データ"
          onAskMayor={onAskMayor}
        />
        <ConversationSection />
      </div>

      <div id="analytics-overview" className="space-y-6">
        <TimeAxisHeading
          title="村の全体像"
          description="これまでの声から、誰が何についてどう感じているか"
          askContext="全期間の全体分析"
          onAskMayor={onAskMayor}
        />
        <div id="analytics-audience">
          <AudienceSection
            onShowVoices={
              onShowVoices
                ? (group, topic) =>
                    onShowVoices({ period: "all", group, topic: topic ?? null })
                : undefined
            }
          />
        </div>
        <PersonaSection />
        <OntologySection />
      </div>

      <TimeAxisHeading
        title="今週のできごと"
        description="週ごとのまとめ。毎週火曜に自動で更新"
        askContext="今週の週次レポート"
        onAskMayor={onAskMayor}
      />
      <ReportsSection />
    </div>
  );
};
