import type { Tab } from "~/app/dashboard/App";
import type { AnalyticsSection } from "~/app/dashboard/components/AnalyticsPanel";
import { Card } from "~/app/dashboard/components/home/Card";
import { LinkButton } from "~/app/dashboard/components/home/LinkButton";
import { TopicRow } from "~/app/dashboard/components/home/TopicRow";
import { WeekSummary } from "~/app/dashboard/components/home/WeekSummary";
import type { VoiceFilter } from "~/app/dashboard/components/voices/helpers";
import { useHomeSummary } from "~/app/dashboard/hooks/useHomeSummary";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { formatDateTime, formatMonthDay } from "~/lib/format";

interface Props {
  onNavigate: (tab: Tab, voicesFilter?: Partial<VoiceFilter>) => void;
  onShowAnalytics: (section?: AnalyticsSection) => void;
}

export const HomePanel = ({ onNavigate, onShowAnalytics }: Props) => {
  const {
    periodLabel,
    positives,
    troubles,
    conversationCount,
    voiceCount,
    bars,
    platforms,
    sentiments,
    ages,
    residences,
    relationships,
    scheduledBroadcasts,
    activePolls,
    isLoading,
    error,
  } = useHomeSummary();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-(--fg-1)">今週の音威子府</h2>
        <p className="text-sm text-(--fg-3) mt-0.5">
          {formatMonthDay(periodLabel.from)}〜{formatMonthDay(periodLabel.to)}
          の声から
        </p>
      </div>

      {/* 声が取れていないのに「ありません」と出すと障害と平穏が区別できないため、声由来のセクションは出さない。取得中も同様 */}
      {error && <ErrorBanner>{formatError(error)}</ErrorBanner>}
      {!error && isLoading && <PanelLoading />}

      {!error && !isLoading && (
        <Card
          title="📊 今週のサマリー"
          action={
            <LinkButton
              label="村の分析で見る"
              onClick={() => onShowAnalytics()}
            />
          }
        >
          <WeekSummary
            conversationCount={conversationCount}
            voiceCount={voiceCount}
            bars={bars}
            platforms={platforms}
            sentiments={sentiments}
            ages={ages}
            residences={residences}
            relationships={relationships}
            onShowConversations={() => onShowAnalytics("conversation")}
            onShowVillage={() => onShowAnalytics("overview")}
            onShowSentiment={(key) =>
              onNavigate("voices", { period: "d7", sents: [key] })
            }
          />
        </Card>
      )}

      {!error && !isLoading && (
        <div className="grid gap-4 items-start lg:grid-cols-2">
          <Card
            title="✨ 今週の話題"
            action={
              <LinkButton
                label="話題別で見る"
                onClick={() =>
                  onNavigate("voices", { period: "d7", sort: "topics" })
                }
              />
            }
          >
            {positives.length === 0 ? (
              <p className="text-sm text-(--fg-3)">
                この7日はポジティブな声がありません。
              </p>
            ) : (
              <ul className="divide-y divide-(--border-1)">
                {positives.map((t) => (
                  <TopicRow
                    key={t.topic}
                    {...t}
                    onShowVoices={(topic) =>
                      onNavigate("voices", {
                        period: "d7",
                        topic,
                        sents: ["positive"],
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="⚠️ 今週の困りごと"
            action={
              <LinkButton
                label="詳しく見る"
                onClick={() =>
                  onNavigate("voices", {
                    period: "d7",
                    sents: ["negative", "request"],
                  })
                }
              />
            }
          >
            {troubles.length === 0 ? (
              <p className="text-sm text-(--fg-3)">
                この7日は困りごとの声がありません。
              </p>
            ) : (
              <ul className="divide-y divide-(--border-1)">
                {troubles.map((t) => (
                  <TopicRow
                    key={t.topic}
                    {...t}
                    onShowVoices={(topic) =>
                      onNavigate("voices", {
                        period: "d7",
                        topic,
                        sents: ["negative", "request"],
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          title="📣 予約中の配信"
          action={
            <LinkButton
              label="すべて見る"
              onClick={() => onNavigate("broadcast")}
            />
          }
        >
          {scheduledBroadcasts.length === 0 ? (
            <p className="text-sm text-(--fg-3)">予約中の配信はありません。</p>
          ) : (
            <ul className="space-y-2">
              {scheduledBroadcasts.map((b) => (
                <li
                  key={b.id}
                  className="flex items-baseline gap-2 text-sm text-(--fg-1)"
                >
                  {b.scheduledAt && (
                    <span className="shrink-0 text-xs text-(--fg-3)">
                      {formatDateTime(b.scheduledAt)}
                    </span>
                  )}
                  <span className="truncate">{b.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="🗳️ 実施中の投票"
          action={
            <LinkButton label="すべて見る" onClick={() => onNavigate("poll")} />
          }
        >
          {activePolls.length === 0 ? (
            <p className="text-sm text-(--fg-3)">実施中の投票はありません。</p>
          ) : (
            <ul className="space-y-2">
              {activePolls.map((p) => (
                <li key={p.id} className="text-sm text-(--fg-1)">
                  <span className="block truncate">{p.title}</span>
                  <span className="text-xs text-(--fg-3)">
                    {p.sentAt && `${formatMonthDay(p.sentAt)}開始 · `}
                    {p.answerCount}件の回答
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
