import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useConversationAnalytics } from "~/app/dashboard/hooks/useAnalytics";
import { AXIS_STYLE, TOOLTIP_STYLE } from "~/lib/chart-helpers";
import { HourlyChart } from "./HourlyChart";
import { SectionCard, SectionError, SectionLoading } from "./SectionCard";
import { StatCards } from "./StatCards";

export const ConversationSection = () => {
  const { data, isLoading, error } = useConversationAnalytics(30);

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
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  name="メッセージ数"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              時間帯分布（JST）
            </h4>
            <HourlyChart hourly={data.hourly} />
          </div>
        </div>
      )}
    </SectionCard>
  );
};
