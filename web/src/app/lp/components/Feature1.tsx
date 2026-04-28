import { useScrollReveal } from "~/hooks/useScrollReveal";
import { Icon } from "./Icon";

type Row = {
  label: string;
  ex: string;
  icon: "cloud" | "train" | "home" | "leaf";
  iconBg: string;
};

const ROWS: ReadonlyArray<Row> = [
  {
    label: "天気・今日の気分",
    ex: "「今日寒い？」「お昼どうしよう？」",
    icon: "cloud",
    iconBg: "bg-(--teal-50) text-(--teal-700)",
  },
  {
    label: "観光のお客さん",
    ex: "「おすすめのお蕎麦屋さんは？」",
    icon: "train",
    iconBg: "bg-(--apricot-50) text-(--honey)",
  },
  {
    label: "移住を考えている方",
    ex: "「移住の補助金ってあるの？」",
    icon: "home",
    iconBg: "bg-(--moss-50) text-(--pine)",
  },
  {
    label: "村に住んでいる方",
    ex: "「今日のゴミ、何の日だっけ？」",
    icon: "leaf",
    iconBg: "bg-[#fdf2f3] text-(--berry)",
  },
];

export const Feature1 = () => {
  const body = useScrollReveal<HTMLDivElement>();
  const visual = useScrollReveal<HTMLDivElement>();

  return (
    <div className="grid items-center gap-10 py-12 md:grid-cols-2 md:gap-20 md:py-20">
      {/* body — md では左、モバイルでは上 */}
      <div
        ref={body.ref}
        data-revealed={body.revealed}
        className="opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
          <span className="grid size-6 place-items-center rounded-full bg-(--teal-700) text-[12px] text-white">
            1
          </span>
          WHAT I KNOW
        </div>
        <h3 className="mt-4 font-(family-name:--font-display) text-[clamp(24px,3.5vw,34px)] font-bold leading-[1.35] text-(--snow-800)">
          村のことを
          <br />
          なんでも知ってるよ
        </h3>
        <p className="mt-5 text-base leading-[1.85] text-(--fg-1)">
          駅に、宿に、役場に——
          <br />
          音威子府のあらゆる情報を、まるごと持ったAIです。
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-2)">
          観光のお客さんも、移住を考えている方も、村に住んでいる人も——みんなそれぞれの質問に、
          <strong className="text-(--fg-1)">
            なんでも明るく相談に乗ってくれます。
          </strong>
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-2)">
          一般的なAIが知らない、音威子府ならではのことをお答えします。村の公式資料・広報誌まで遡って調べてくれます。
        </p>
      </div>

      {/* visual — md では右 */}
      <div
        ref={visual.ref}
        data-revealed={visual.revealed}
        className="opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="flex flex-col gap-2 rounded-[28px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-float-md)">
          {ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 rounded-2xl bg-(--paper-50) px-4 py-3"
            >
              <span
                className={`grid size-9 flex-none place-items-center rounded-full ${row.iconBg}`}
              >
                <Icon name={row.icon} size={16} />
              </span>
              <span className="font-medium text-(--fg-1)">{row.label}</span>
              <span className="ml-auto truncate text-xs text-(--fg-3)">
                {row.ex}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
