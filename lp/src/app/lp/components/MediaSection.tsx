import { useScrollReveal } from "@nepp-chan/shared/hooks/useScrollReveal";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef } from "react";

type MediaKind = "paper" | "web" | "tv" | "radio" | "mag";

type MediaItem = {
  outlet: string;
  kind: string;
  kindCls: MediaKind;
  date: string;
  headline: string;
  mast: string;
};

const MEDIA: ReadonlyArray<MediaItem> = [
  {
    outlet: "日本経済新聞",
    kind: "新聞",
    kindCls: "paper",
    date: "2026.02.20",
    headline: "音威子府村に「AI副村長」 PC・スマホで村民らの疑問に回答",
    mast: "日本経済新聞",
  },
  {
    outlet: "日本経済新聞 電子版",
    kind: "Web",
    kindCls: "web",
    date: "2026.02.19",
    headline: "北海道音威子府村に「17歳のAI副村長」 村民などの疑問に回答",
    mast: "NIKKEI",
  },
  {
    outlet: "日経MJ",
    kind: "新聞",
    kindCls: "paper",
    date: "2026.03.02",
    headline: "副村長は「17歳のAI」 自然な対話、村民らの質問に回答",
    mast: "日経MJ",
  },
  {
    outlet: "北海道新聞",
    kind: "新聞",
    kindCls: "paper",
    date: "2026.03.06",
    headline: "村の相談 AIが回答 音威子府で実証実験",
    mast: "北海道新聞",
  },
  {
    outlet: "北海道新聞 朝刊（旭川・上川）",
    kind: "新聞",
    kindCls: "paper",
    date: "2026.02.28",
    headline: "AI副村長ねっぷちゃん 音威子府で実証実験",
    mast: "北海道新聞",
  },
  {
    outlet: "北海道新聞デジタル",
    kind: "Web",
    kindCls: "web",
    date: "2026.02.27",
    headline: "「AI副村長ねっぷちゃん」音威子府で実証実験 ネットで公開",
    mast: "DO-SHIN",
  },
  {
    outlet: "札幌テレビ「どさんこワイド179」",
    kind: "TV",
    kindCls: "tv",
    date: "2026.02.25",
    headline: "道内に17歳の副村長が誕生!?",
    mast: "STV",
  },
  {
    outlet: "STVラジオ「あさミミ！」",
    kind: "ラジオ",
    kindCls: "radio",
    date: "2026.02.20",
    headline: "音威子府村にAI副村長が登場",
    mast: "STV RADIO",
  },
  {
    outlet: "財界さっぽろ 4月号",
    kind: "雑誌",
    kindCls: "mag",
    date: "2026.03.15",
    headline: "目指せ地域のドラえもん、音威子府村のAI副村長",
    mast: "財界さっぽろ",
  },
  {
    outlet: "北海道経済 5月号",
    kind: "雑誌",
    kindCls: "mag",
    date: "2026.05.01",
    headline: "道内人口最少 音威子府村にAI副村長ねっぷちゃん",
    mast: "北海道経済",
  },
];

const KIND_BADGE: Record<MediaKind, string> = {
  paper: "bg-(--snow-100) text-(--snow-700)",
  web: "bg-(--sky-50) text-(--sky-700)",
  tv: "bg-(--apricot-50) text-(--apricot-700)",
  radio: "bg-(--moss-50) text-(--pine)",
  mag: "bg-[#fdf2f3] text-(--berry)",
};

export const MediaSection = () => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const header = useScrollReveal<HTMLDivElement>();
  const carousel = useScrollReveal<HTMLDivElement>();

  const scroll = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  return (
    <section
      id="press"
      className="scroll-mt-20 bg-(--paper-100)/60 py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-7">
        <div
          ref={header.ref}
          data-revealed={header.revealed}
          className="text-center opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
        >
          <div className="inline-block rounded-(--r-pill) bg-(--teal-50) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
            Press
          </div>
          <h2 className="mt-4 font-(family-name:--font-display) text-xl font-bold sm:text-2xl md:text-3xl lg:text-4xl xl:text-[44px] leading-[1.35] text-(--snow-800)">
            メディアに取り上げられました
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[17px] leading-[1.85] text-(--fg-2)">
            全国紙・地方紙・TV・ラジオ・雑誌で、ねっぷちゃんの取り組みが紹介されています。
          </p>
        </div>

        <div
          ref={carousel.ref}
          data-revealed={carousel.revealed}
          className="relative mt-12 opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
        >
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {MEDIA.map((m) => (
              <article
                key={m.outlet + m.date}
                className="flex w-[300px] flex-none snap-start flex-col gap-3 rounded-[24px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-sm)"
              >
                <div className="rounded-2xl bg-(--paper-50) px-4 py-6 text-center font-(family-name:--font-display) text-lg font-black text-(--snow-700)">
                  {m.mast}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-(--r-pill) px-2.5 py-0.5 text-[11px] font-bold ${KIND_BADGE[m.kindCls]}`}
                  >
                    {m.kind}
                  </span>
                  <span className="text-xs text-(--fg-3)">{m.date}</span>
                </div>
                <h4 className="font-(family-name:--font-display) text-base font-bold leading-[1.5] text-(--snow-800)">
                  {m.headline}
                </h4>
                <div className="mt-auto border-t border-dashed border-(--paper-200) pt-3 text-xs text-(--fg-3)">
                  {m.outlet}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              aria-label="前へ"
              onClick={() => scroll(-1)}
              className="grid size-10 place-items-center rounded-full border border-(--paper-200) bg-white text-(--fg-2) shadow-(--shadow-sm) transition-colors hover:bg-(--teal-50) hover:text-(--brand)"
            >
              <ChevronLeftIcon className="size-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="次へ"
              onClick={() => scroll(1)}
              className="grid size-10 place-items-center rounded-full border border-(--paper-200) bg-white text-(--fg-2) shadow-(--shadow-sm) transition-colors hover:bg-(--teal-50) hover:text-(--brand)"
            >
              <ChevronRightIcon className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
