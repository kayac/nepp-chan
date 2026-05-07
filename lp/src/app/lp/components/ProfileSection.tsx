import { useScrollReveal } from "@nepp-chan/shared/hooks/useScrollReveal";

const ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "名前", value: "ねっぷちゃん" },
  { label: "肩書き", value: "音威子府村 AI副村長" },
  { label: "住んでいる場所", value: "北海道音威子府村" },
  { label: "種族", value: "白おこじょ（エゾオコジョ）" },
  { label: "得意なこと", value: "村のことをなんでも教えること" },
  { label: "好きなもの", value: "雪・絵を描くこと・村のみんな" },
];

export const ProfileSection = () => {
  const header = useScrollReveal<HTMLDivElement>();
  const grid = useScrollReveal<HTMLDivElement>();

  return (
    <section id="profile" className="scroll-mt-20 px-7 py-20 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <div
          ref={header.ref}
          data-revealed={header.revealed}
          className="text-center opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
        >
          <div className="inline-block rounded-(--r-pill) bg-(--teal-50) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
            Profile
          </div>
          <h2 className="mt-4 font-(family-name:--font-display) text-xl font-bold sm:text-2xl md:text-3xl lg:text-4xl xl:text-[44px] leading-[1.35] text-(--snow-800)">
            ねっぷちゃんって、どんな子？
          </h2>
        </div>

        <div
          ref={grid.ref}
          data-revealed={grid.revealed}
          className="mt-12 grid items-center gap-12 opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0 md:grid-cols-2 md:gap-20"
        >
          <div className="flex justify-center">
            <img
              src="/lp/neppuchan-fullbody.png"
              alt="ねっぷちゃん 全身"
              className="w-full max-w-[360px] object-contain [filter:drop-shadow(0_18px_30px_rgba(28,25,23,0.12))_drop-shadow(0_6px_12px_rgba(28,25,23,0.08))]"
            />
          </div>
          <div>
            <dl className="flex flex-col gap-3 rounded-[28px] border border-(--paper-200) bg-white p-6 shadow-(--shadow-float-sm) md:p-8">
              {ROWS.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[120px_1fr] items-baseline gap-3 border-b border-dashed border-(--paper-200) pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-(--brand)">
                    {row.label}
                  </dt>
                  <dd className="font-(family-name:--font-display) text-base font-bold text-(--snow-800)">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-base leading-[1.85] text-(--fg-2)">
              村の小さなことも、大切なことも。
              <br className="hidden md:inline" />
              あなたのそばに、ねっぷちゃんがいます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
