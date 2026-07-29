import { useMemo } from "react";
import type { Tab } from "~/app/dashboard/App";
import {
  percentChange,
  sumConversationsInRange,
  topTopics,
  troubleTopics,
  weekPeriods,
} from "~/app/dashboard/components/home/helpers";
import type { VoiceFilter } from "~/app/dashboard/components/voices/helpers";
import {
  useConversationAnalytics,
  usePersonaAnalytics,
} from "~/app/dashboard/hooks/useAnalytics";
import { useBroadcasts } from "~/app/dashboard/hooks/useBroadcasts";
import { useEmergencies } from "~/app/dashboard/hooks/useEmergencies";
import { usePolls } from "~/app/dashboard/hooks/usePolls";
import { toDateString } from "~/lib/date";
import { formatDateTime } from "~/lib/format";

interface Props {
  onNavigate: (tab: Tab, voicesFilter?: Partial<VoiceFilter>) => void;
}

const formatPeriodDate = (dateStr: string) => {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}月${Number(d)}日`;
};

const Card = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-(--fg-1)">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const LinkButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="text-sm font-medium text-(--brand) hover:text-(--brand-press) shrink-0"
  >
    {label} →
  </button>
);

export const HomePanel = ({ onNavigate }: Props) => {
  const { current, previous } = useMemo(() => weekPeriods(new Date()), []);

  const currentPersona = usePersonaAnalytics({
    from: current.from,
    to: current.to,
  });
  const previousPersona = usePersonaAnalytics({
    from: previous.from,
    to: previous.to,
  });
  const conversations = useConversationAnalytics(30);
  const emergencies = useEmergencies();
  const broadcasts = useBroadcasts(5, { status: "scheduled" });
  const polls = usePolls(5, { status: "sent" });

  const thisWeekEmergencies = (emergencies.data?.emergencies ?? []).filter(
    (e) => toDateString(new Date(e.reportedAt)) >= current.from,
  );

  const troubles = troubleTopics(
    currentPersona.data?.topics ?? [],
    previousPersona.data?.topics,
  );
  const tops = topTopics(
    currentPersona.data?.topics ?? [],
    previousPersona.data?.topics,
  );

  const daily = conversations.data?.daily ?? [];
  const weekConversations = sumConversationsInRange(
    daily,
    current.from,
    current.to,
  );
  const weekChange = percentChange(
    weekConversations,
    sumConversationsInRange(daily, previous.from, previous.to),
  );

  const scheduledBroadcasts =
    broadcasts.data?.pages.flatMap((p) => p.broadcasts) ?? [];
  const activePolls = polls.data?.pages.flatMap((p) => p.polls) ?? [];

  const isLoading = currentPersona.isLoading || conversations.isLoading;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-(--fg-1)">今週の音威子府</h2>
        <p className="text-sm text-(--fg-3) mt-0.5">
          {formatPeriodDate(current.from)} 〜 {formatPeriodDate(current.to)}
        </p>
      </div>

      {thisWeekEmergencies.length > 0 && (
        <section className="bg-(--danger-bg) rounded-xl border border-(--border-1) p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-base font-semibold text-(--fg-1)">
              緊急の報告
            </h3>
            <LinkButton
              label="みんなの声で見る"
              onClick={() =>
                onNavigate("voices", { period: "week", sents: ["emergency"] })
              }
            />
          </div>
          <ul className="space-y-1.5">
            {thisWeekEmergencies.map((e) => (
              <li key={e.id} className="text-sm text-(--fg-1)">
                <span className="font-semibold">{e.type}</span>：{e.description}
                <span className="text-(--fg-3) ml-2 text-xs">
                  {formatDateTime(e.reportedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-3 bg-(--bg-raised) rounded-xl border border-(--border-1) px-5 py-3">
        <p className="text-sm text-(--fg-2) truncate">
          {isLoading
            ? "読み込み中..."
            : `今週の会話 ${weekConversations}${
                weekChange !== null
                  ? `（先週比 ${weekChange >= 0 ? "▲" : "▼"}${Math.abs(weekChange)}%）`
                  : ""
              }`}
        </p>
        <LinkButton
          label="村の分析で見る"
          onClick={() => onNavigate("analytics")}
        />
      </div>

      <Card
        title="今週の困りごと"
        action={
          <LinkButton
            label="詳しく見る"
            onClick={() =>
              onNavigate("voices", {
                period: "week",
                sents: ["negative", "request"],
              })
            }
          />
        }
      >
        {troubles.length === 0 ? (
          <p className="text-sm text-(--fg-3)">
            今週はまだ困りごとの声がありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {troubles.map((t) => (
              <li
                key={t.topic}
                data-testid="trouble-topic"
                className="flex items-center gap-3 text-sm text-(--fg-1)"
              >
                <span className="min-w-8 h-8 px-2 rounded-(--r-pill) bg-(--warning-bg) font-bold flex items-center justify-center">
                  {t.count}
                </span>
                <span className="font-medium">{t.topic}</span>
                {t.diff > 0 && (
                  <span className="text-xs text-(--danger)">
                    ▲{t.diff} 先週より増
                  </span>
                )}
                {t.diff < 0 && (
                  <span className="text-xs text-(--fg-3)">
                    ▼{Math.abs(t.diff)} 先週より減
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="トップトピック"
        action={
          <button
            type="button"
            onClick={() => onNavigate("broadcast")}
            className="text-sm font-medium text-(--fg-on-brand) bg-(--brand) hover:bg-(--brand-press) rounded-(--r-pill) px-4 py-1.5 shrink-0"
          >
            お知らせを作る
          </button>
        }
      >
        {tops.length === 0 ? (
          <p className="text-sm text-(--fg-3)">
            今週はまだ話題が集まっていません。
          </p>
        ) : (
          <ol className="space-y-2">
            {tops.map((t, i) => (
              <li
                key={t.topic}
                data-testid="top-topic"
                className="flex items-center gap-3 text-sm text-(--fg-1)"
              >
                <span className="w-6 text-(--fg-3) font-bold">{i + 1}</span>
                <span className="font-medium">{t.topic}</span>
                <span className="text-xs text-(--fg-3)">{t.total}件</span>
                {t.isNew && (
                  <span className="text-[11px] font-bold text-(--danger)">
                    ▲ NEW
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          title="予約中の配信"
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
                <li key={b.id} className="text-sm text-(--fg-1)">
                  {b.scheduledAt && (
                    <span className="text-xs text-(--fg-3) mr-2">
                      {formatDateTime(b.scheduledAt)}
                    </span>
                  )}
                  {b.title}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="実施中の投票"
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
                  {p.title}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
