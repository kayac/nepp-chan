import { useScrollReveal } from "~/hooks/useScrollReveal";

const PILLS: ReadonlyArray<{ label: string; color: string }> = [
  { label: "音威子府駅", color: "#c4553f" },
  { label: "エゾマツの森", color: "#4a6a62" },
  { label: "天塩川", color: "#cfdfe5" },
  { label: "黒い蕎麦", color: "#2d3a38" },
  { label: "ビッキ記念館", color: "#8a4735" },
];

export const Feature2 = () => {
  const visual = useScrollReveal<HTMLDivElement>();
  const body = useScrollReveal<HTMLDivElement>();

  return (
    <div className="grid items-center gap-10 py-12 md:grid-cols-2 md:gap-20 md:py-20">
      {/* visual — md では左、モバイルでは上 */}
      <div
        ref={visual.ref}
        data-revealed={visual.revealed}
        className="opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="relative overflow-hidden rounded-[32px] border border-(--paper-200) bg-white shadow-(--shadow-float-md)">
          <img
            src="/lp/otoineppu-illust.png"
            alt="音威子府村の風景イラスト"
            className="block aspect-[4/3] w-full object-cover"
          />
          <div className="flex flex-wrap gap-1.5 px-5 py-4">
            {PILLS.map((pill) => (
              <span
                key={pill.label}
                className="inline-flex items-center gap-1.5 rounded-(--r-pill) border border-(--paper-200) bg-(--paper-50) px-3 py-1 text-xs text-(--fg-2)"
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: pill.color }}
                />
                {pill.label}
              </span>
            ))}
          </div>
          <div className="absolute right-5 top-5 grid size-16 place-items-center rounded-full border-2 border-(--apricot-700) bg-white/90 text-center font-(family-name:--font-display) text-(--apricot-700) [transform:rotate(-8deg)]">
            <div className="text-2xl font-black leading-none">音</div>
            <div className="text-[8px] font-bold tracking-wider">OTOINEPPU</div>
          </div>
        </div>
      </div>

      {/* body — md では右 */}
      <div
        ref={body.ref}
        data-revealed={body.revealed}
        className="opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0 md:order-2"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
          <span className="grid size-6 place-items-center rounded-full bg-(--teal-700) text-[12px] text-white">
            2
          </span>
          GUIDE
        </div>
        <h3 className="mt-4 font-(family-name:--font-display) text-[clamp(24px,3.5vw,34px)] font-bold leading-[1.35] text-(--snow-800)">
          音威子府村を
          <br />
          ねっぷちゃんと
          <br />
          お散歩しよう
        </h3>
        <p className="mt-5 text-base leading-[1.85] text-(--fg-1)">
          自然・文化・グルメ・アクティビティ——
          <br />
          村のことなら、ねっぷちゃんが道しるべ。
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-2)">
          村の見どころを、ねっぷちゃんが順路で案内。気になる場所は深掘りして、そこに行くまでの交通手段や営業時間まで、あわせて教えてくれます。
        </p>
      </div>
    </div>
  );
};
