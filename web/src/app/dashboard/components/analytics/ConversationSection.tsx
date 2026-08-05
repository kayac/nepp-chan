import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useConversationAnalytics,
  usePersonaAnalytics,
} from "~/app/dashboard/hooks/useAnalytics";
import { closedContext } from "~/lib/analytics-summary";
import { AXIS_STYLE, TOOLTIP_STYLE } from "~/lib/chart-helpers";
import { HourlyChart } from "./HourlyChart";
import { jstDateRange } from "./helpers";
import { PersonaPeriodSummary } from "./PersonaPeriodSummary";
import { SectionCard, SectionError, SectionLoading } from "./SectionCard";
import { StatCards } from "./StatCards";
import { WeekdayChart } from "./WeekdayChart";

const DAYS = 30;

export const ConversationSection = () => {
  const { data, isLoading, error } = useConversationAnalytics(DAYS);
  const { data: personaData } = usePersonaAnalytics(jstDateRange(DAYS));

  const closed = personaData
    ? closedContext(
        personaData.officeHours.open,
        personaData.officeHours.closed,
      )
    : null;

  return (
    <SectionCard
      title="会話量"
      description="直近 30 日（それ以前は週次レポートを参照）"
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data && (
        <div className="space-y-6">
          <StatCards
            conversations={data.totals.conversations}
            messages={data.totals.messages}
            platforms={data.platforms}
          />

          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              日別の会話数・メッセージ数
            </h4>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={data.daily}
                margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="date"
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  tickFormatter={(date: string) => date.slice(5)}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  name="会話数"
                  stroke="#0d9296"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  name="メッセージ数"
                  stroke="#89a8c0"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-2">
                時間帯分布
              </h4>
              <HourlyChart hourly={data.hourly} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-2">
                曜日分布
              </h4>
              <WeekdayChart weekday={data.weekday} />
            </div>
          </div>

          {closed && (
            <p className="text-sm text-(--fg-2) bg-(--bg-sunken) rounded-lg px-4 py-3">
              {closed.perN >= 2
                ? `役場が閉まっている時間も、${closed.perN}件に1件はねっぷちゃんが応対しています（全体の${closed.percent}%）。`
                : `役場が閉まっている時間の応対が全体の${closed.percent}%を占めています。`}
            </p>
          )}

          {personaData && (
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-2">
                同期間の声の傾向（ペルソナ）
              </h4>
              <PersonaPeriodSummary data={personaData} />
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};
