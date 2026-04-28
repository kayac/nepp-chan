import { useScrollReveal } from "~/hooks/useScrollReveal";
import { Icon, LineIcon } from "./Icon";

export const FinalCTA = () => {
  const reveal = useScrollReveal<HTMLDivElement>();

  return (
    <section className="px-7 py-20 md:py-28">
      <div
        ref={reveal.ref}
        data-revealed={reveal.revealed}
        className="mx-auto max-w-[880px] rounded-[40px] border border-(--paper-200) bg-[radial-gradient(ellipse_at_top,_var(--teal-50),_var(--paper-0))] px-7 py-16 text-center opacity-0 translate-y-3 shadow-(--shadow-float-md) transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0 md:px-12 md:py-20"
      >
        <h2 className="font-(family-name:--font-display) text-xl font-black sm:text-2xl md:text-3xl lg:text-[40px] leading-[1.4] text-(--snow-800)">
          さっそく、
          <br />
          ねっぷちゃんに話しかけてみよう
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] text-base leading-[1.85] text-(--fg-2)">
          駅も、宿も、役場も。音威子府のことはぜんぶ、ねっぷちゃんに聞いてね。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-(--r-pill) bg-(--brand) px-6 py-3.5 text-sm font-bold text-white shadow-(--shadow-brand) transition-all duration-200 hover:-translate-y-0.5 hover:bg-(--brand-hover)"
          >
            <Icon name="message-circle" size={16} />
            Web版でいますぐ話しかける
          </a>
          {/* TODO: LINE 公式アカウント URL 確定後、href を実 URL に差し替え (#541) */}
          <a
            href="#line"
            className="inline-flex items-center gap-2 rounded-(--r-pill) border border-(--paper-200) bg-white px-6 py-3.5 text-sm font-bold text-(--fg-1) shadow-(--shadow-sm) transition-all duration-200 hover:-translate-y-0.5 hover:border-(--teal-300) hover:text-(--brand)"
          >
            <LineIcon size={16} />
            LINEで友達追加
          </a>
        </div>
      </div>
    </section>
  );
};
