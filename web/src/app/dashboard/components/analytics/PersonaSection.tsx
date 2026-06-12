import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePersonaAnalytics } from "~/app/dashboard/hooks/useAnalytics";
import {
  AXIS_STYLE,
  getColorAt,
  NEPP_CHART_COLORS,
  TOOLTIP_STYLE,
} from "~/lib/chart-helpers";
import { HourlyChart } from "./HourlyChart";
import { SENTIMENT_SERIES, sentimentTotal } from "./helpers";
import { SectionCard, SectionError, SectionLoading } from "./SectionCard";

const SentimentBars = () =>
  SENTIMENT_SERIES.map((s) => (
    <Bar
      key={s.key}
      dataKey={s.key}
      name={s.label}
      stackId="sentiment"
      fill={s.color}
    />
  ));

const SegmentPie = ({
  title,
  data,
}: {
  title: string;
  data: { label: string; count: number }[];
}) => (
  <div>
    <h4 className="text-sm font-medium text-stone-700 mb-2">{title}</h4>
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={70}
          dataKey="count"
          nameKey="label"
        >
          {data.map((item, index) => (
            <Cell
              key={item.label}
              fill={getColorAt(index, NEPP_CHART_COLORS)}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend layout="horizontal" verticalAlign="bottom" align="center" />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export const PersonaSection = () => {
  const { data, isLoading, error } = usePersonaAnalytics();

  // 不明が大半（判明率 ~5%）でチャートが潰れるため、判明分のみ描画して
  // 不明はキャプションで件数を示す
  const knownAges = data?.ageSentiment.filter((a) => a.age !== "不明") ?? [];
  const knownCount = knownAges.reduce((sum, a) => sum + sentimentTotal(a), 0);
  const unknownCount = (data?.totalCount ?? 0) - knownCount;
  const knownRate =
    data && data.totalCount > 0
      ? Math.round((knownCount / data.totalCount) * 1000) / 10
      : 0;

  return (
    <SectionCard
      title="ペルソナ分析"
      description={`蓄積された村の声の傾向（全期間・${data?.totalCount.toLocaleString() ?? "-"} 件）`}
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data && (
        <div className="space-y-8">
          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              時間帯分布（JST）
            </h4>
            <HourlyChart hourly={data.hourly} tooltipLabel="ペルソナ件数" />
            <p className="text-xs text-stone-500 mt-1">
              ※会話終了時刻ベースの近似値。1会話から複数件抽出されるため、件数は会話数とは一致しません。
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              年代別ネガポジ
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={knownAges}
                margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="age"
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                {SentimentBars()}
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-stone-500 mt-1">
              ※年代が判明した {knownCount.toLocaleString()} 件のみ表示（判明率{" "}
              {knownRate}%）。不明 {unknownCount.toLocaleString()}{" "}
              件は除外しています。
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              トピックごとの割合
            </h4>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={data.topics}
                layout="vertical"
                margin={{ top: 10, right: 20, bottom: 0, left: 8 }}
              >
                <XAxis
                  type="number"
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="topic"
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  width={56}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                {SentimentBars()}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <SegmentPie
              title="居住地（村内/村外）"
              data={data.segments.residence.filter((s) => s.count > 0)}
            />
            <SegmentPie
              title="関係性（村人/観光客など）"
              data={data.segments.relationship.filter((s) => s.count > 0)}
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
};
