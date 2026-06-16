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
import { WeekdayChart } from "./WeekdayChart";

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

/** 判明/不明を分離して件数・比率を返す */
const splitKnownUnknown = (data: { label: string; count: number }[]) => {
  const unknown = data.find((s) => s.label === "不明")?.count ?? 0;
  const known = data.filter((s) => s.label !== "不明" && s.count > 0);
  const total = data.reduce((sum, s) => sum + s.count, 0);
  const knownTotal = total - unknown;
  const rate = total > 0 ? Math.round((knownTotal / total) * 1000) / 10 : 0;
  const barWidth = Math.max(rate, 15);
  return { known, unknown, knownTotal, total, rate, barWidth };
};

/**
 * teal枠でグラフを囲み → グラデーション漏斗 → 判明/不明ゲージ（下）
 * 枠の全幅がゲージの判明部分に収束するグラデーションで包含関係を表現
 */
const DrillDownSection = ({
  knownLabel,
  knownTotal,
  unknownCount,
  rate,
  barWidth,
  children,
}: {
  knownLabel: string;
  knownTotal: number;
  unknownCount: number;
  rate: number;
  barWidth: number;
  children: React.ReactNode;
}) => (
  <div>
    {/* グラフ本体を teal 枠で囲む */}
    <div className="rounded-lg p-1" style={{ border: "2px solid #5cb7bb" }}>
      {children}
    </div>

    {/* グラデーション逆漏斗: 枠全幅 → ゲージ判明幅 */}
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="block w-full h-7 -mt-px -mb-px"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="funnel-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5cb7bb" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4ea7ab" stopOpacity="0.10" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,0 100,0 ${barWidth},28 0,28`}
        fill="url(#funnel-down)"
      />
    </svg>

    {/* 判明/不明ゲージ */}
    <div className="flex h-[34px] rounded-lg overflow-hidden text-xs font-semibold">
      <div
        className="flex items-center px-3 text-white whitespace-nowrap"
        style={{
          width: `${barWidth}%`,
          minWidth: "fit-content",
          background: "linear-gradient(180deg, #6cc3c7 0%, #4ea7ab 100%)",
        }}
      >
        {knownLabel} {knownTotal.toLocaleString()} 件（{rate}%）
      </div>
      <div
        className="flex flex-1 items-center justify-end px-3 text-stone-500 whitespace-nowrap"
        style={{
          background:
            "repeating-linear-gradient(45deg, #e7e5e4 0 6px, #f1efee 6px 12px)",
        }}
      >
        不明 {unknownCount.toLocaleString()} 件
      </div>
    </div>
  </div>
);

const SegmentPieChart = ({
  data,
}: {
  data: { label: string; count: number }[];
}) => (
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
          <Cell key={item.label} fill={getColorAt(index, NEPP_CHART_COLORS)} />
        ))}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
    </PieChart>
  </ResponsiveContainer>
);

const SegmentPie = ({
  title,
  data,
}: {
  title: string;
  data: { label: string; count: number }[];
}) => {
  const seg = splitKnownUnknown(data);
  const pieData = seg.unknown > 0 ? seg.known : data.filter((s) => s.count > 0);
  return (
    <div>
      <h4 className="text-sm font-medium text-stone-700 mb-2">{title}</h4>
      {seg.unknown > 0 ? (
        <DrillDownSection
          knownLabel="判明"
          knownTotal={seg.knownTotal}
          unknownCount={seg.unknown}
          rate={seg.rate}
          barWidth={seg.barWidth}
        >
          <SegmentPieChart data={pieData} />
        </DrillDownSection>
      ) : (
        <SegmentPieChart data={pieData} />
      )}
    </div>
  );
};

export const PersonaSection = () => {
  const { data, isLoading, error } = usePersonaAnalytics();

  // 不明が大半を占めるとチャートが潰れるため、判明分のみ描画して
  // 不明はキャプションで件数を示す
  const knownAges = data?.ageSentiment.filter((a) => a.age !== "不明") ?? [];
  const knownCount = knownAges.reduce((sum, a) => sum + sentimentTotal(a), 0);
  const unknownCount = (data?.totalCount ?? 0) - knownCount;
  const knownRate =
    data && data.totalCount > 0
      ? Math.round((knownCount / data.totalCount) * 1000) / 10
      : 0;
  // 親バーと漏斗の描画幅: 判明率が低い場合でもテキストが収まるよう最小15%を確保
  const knownBarWidth = Math.max(knownRate, 15);

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
            <div className="grid grid-cols-2 gap-3 sm:max-w-md mb-4">
              <div
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: "#5cb7bb66",
                  backgroundColor: "#5cb7bb14",
                }}
              >
                <p className="text-xs text-stone-600">開庁時間に集まった声</p>
                <p className="text-2xl font-bold text-stone-800 tabular-nums">
                  {data.officeHours.open.toLocaleString()}
                  <span className="text-xs font-normal text-stone-500 ml-1">
                    件
                  </span>
                </p>
                <p className="text-[11px] text-stone-500">
                  平日 8〜17時（JST）
                </p>
              </div>
              <div
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: "#f4a06a66",
                  backgroundColor: "#f4a06a14",
                }}
              >
                <p className="text-xs text-stone-600">閉庁時間に集まった声</p>
                <p className="text-2xl font-bold text-stone-800 tabular-nums">
                  {data.officeHours.closed.toLocaleString()}
                  <span className="text-xs font-normal text-stone-500 ml-1">
                    件
                  </span>
                </p>
                <p className="text-[11px] text-stone-500">早朝・夜間・土日</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">
                  時間帯分布（JST）
                </h4>
                <HourlyChart hourly={data.hourly} tooltipLabel="ペルソナ件数" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">
                  曜日分布（JST）
                </h4>
                <WeekdayChart
                  weekday={data.weekday}
                  tooltipLabel="ペルソナ件数"
                />
              </div>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              ※いずれも会話終了時刻ベースの近似値。1会話から複数件抽出されるため、件数は会話数とは一致しません。
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              年代別ネガポジ
            </h4>

            <DrillDownSection
              knownLabel="判明"
              knownTotal={knownCount}
              unknownCount={unknownCount}
              rate={knownRate}
              barWidth={knownBarWidth}
            >
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
            </DrillDownSection>
            <p className="text-xs text-stone-500 mt-1">
              ※年代が判明した {knownCount.toLocaleString()} 件（判明率{" "}
              {knownRate}%）の内訳。不明 {unknownCount.toLocaleString()}{" "}
              件は上の帯で割合のみ表示。
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
