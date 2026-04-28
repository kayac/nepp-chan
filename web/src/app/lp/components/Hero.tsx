import { useScrollReveal } from "~/hooks/useScrollReveal";
import { LineIcon } from "./Icon";
import { MiniChat } from "./MiniChat";

export const Hero = () => {
  const text = useScrollReveal<HTMLDivElement>();
  const chat = useScrollReveal<HTMLDivElement>();

  return (
    <section className="relative scroll-mt-20 px-7 pb-32 pt-12 md:pb-40">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
        <div
          ref={text.ref}
          data-revealed={text.revealed}
          className="opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
        >
          <span className="inline-flex items-center gap-2 rounded-(--r-pill) bg-white px-3 py-1.5 text-xs font-medium text-(--fg-2) shadow-(--shadow-xs)">
            <span
              aria-hidden="true"
              className="relative inline-block size-2 rounded-full bg-(--success) after:content-[''] after:absolute after:-inset-1 after:rounded-full after:bg-(--success)/40 after:animate-[lp-tag-pulse_1.8s_ease-out_infinite]"
            />
            音威子府村 公式 AI副村長
          </span>

          <h1 className="mt-6 font-(family-name:--font-display) text-[clamp(24px,7vw,30px)] font-black leading-[1.4] tracking-[0.01em] text-(--snow-800) md:text-2xl lg:text-3xl xl:text-4xl">
            駅も、宿も、役場も。
            <br />
            <span className="text-(--brand)">音威子府のことはぜんぶ、</span>
            <br />
            ねっぷちゃんに聞いてね。
          </h1>

          <p className="mt-6 max-w-[520px] text-base leading-[1.85] text-(--fg-2)">
            北海道のいちばん小さな村、音威子府（おといねっぷ）村に、
            <br className="hidden md:inline" />
            AI副村長「ねっぷちゃん」が誕生しました。
            <br className="hidden md:inline" />
            村のことなら、なんでもお話しできます。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="#chat"
              className="flex items-center justify-center gap-2 rounded-(--r-pill) bg-(--brand) px-6 py-3.5 text-sm font-bold text-white shadow-(--shadow-brand) transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-(--brand-hover) hover:shadow-[0_10px_24px_rgba(15,118,110,0.32)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-4"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              いますぐ話しかける
            </a>
            <a
              href="#line"
              className="flex items-center justify-center gap-2 rounded-(--r-pill) bg-[#06c755] px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(6,199,85,0.22)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#05b048] hover:shadow-[0_10px_24px_rgba(6,199,85,0.36)]"
            >
              <LineIcon size={16} />
              LINEで友達追加
            </a>
          </div>
        </div>

        <div
          ref={chat.ref}
          id="chat"
          data-revealed={chat.revealed}
          className="relative scroll-mt-20 opacity-0 translate-y-3 transition-all duration-700 delay-150 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
        >
          <div
            aria-hidden="true"
            className="absolute -top-[60px] right-0 z-10 size-24 animate-[lp-mascot-tilt_5s_ease-in-out_infinite] [filter:drop-shadow(0_8px_16px_rgba(15,118,110,0.14))] sm:size-[140px]"
          >
            <img
              src="/mascot/pose-wave.png"
              alt=""
              className="size-full object-contain"
            />
          </div>
          <MiniChat />
        </div>
      </div>
    </section>
  );
};
