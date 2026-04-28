import { useScrollReveal } from "~/hooks/useScrollReveal";
import { LineIcon } from "./Icon";

// `**bold**` を <strong> に置換する。入力ソースは hardcode のみ。
const renderInlineBold = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

export const Line = () => {
  const body = useScrollReveal<HTMLDivElement>();
  const visual = useScrollReveal<HTMLDivElement>();

  return (
    <div
      id="line"
      className="grid scroll-mt-20 items-center gap-10 py-12 md:grid-cols-2 md:gap-20 md:py-20"
    >
      <div
        ref={body.ref}
        data-revealed={body.revealed}
        className="min-w-0 opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
          <span className="grid size-6 place-items-center rounded-full bg-(--teal-700) text-[12px] text-white">
            3
          </span>
          LINE
        </div>
        <h3 className="mt-4 font-(family-name:--font-display) text-xl font-bold sm:text-2xl md:text-[28px] lg:text-[34px] leading-[1.35] text-(--snow-800)">
          LINEで
          <br className="hidden md:inline" />
          お友達になれるよ！
        </h3>
        <p className="mt-5 text-base leading-[1.85] text-(--fg-1)">
          難しい操作は不要。
          <br className="hidden md:inline" />
          いつものLINEで、気軽に話しかけてね。
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-2)">
          LINEのお友達に追加するだけで、いつでもねっぷちゃんとお話しできます。村の最新情報やお知らせもお届けするよ！
        </p>
        {/* LINE 公式アカウント URL は別 Issue で確定するため暫定で button + alert に */}
        <button
          type="button"
          onClick={() => window.alert("LINE公式アカウントは準備中です")}
          className="mt-6 inline-flex items-center gap-2 rounded-(--r-pill) bg-[#06c755] px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(6,199,85,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#05b048] hover:shadow-[0_10px_24px_rgba(6,199,85,0.36)]"
        >
          <LineIcon size={16} />
          LINE友達追加はこちら
        </button>
      </div>

      <div
        ref={visual.ref}
        data-revealed={visual.revealed}
        className="flex justify-center min-w-0 opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="relative w-[280px] overflow-hidden rounded-[36px] border-[10px] border-(--snow-800) bg-(--paper-50) shadow-(--shadow-float-lg)">
          <div className="bg-(--snow-800) px-4 py-1.5 text-center text-[10px] text-white">
            9:41 · 音威子府村
          </div>
          <div className="flex items-center gap-2.5 bg-[#06c755] px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white/20 font-bold">
              ね
            </span>
            <div className="flex flex-col text-sm font-bold">
              <span>ねっぷちゃん</span>
              <span className="text-[10px] font-normal opacity-85">
                音威子府村 公式アカウント
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-4 py-5">
            <div className="flex items-end gap-2">
              <span className="grid size-7 flex-none place-items-center overflow-hidden rounded-full bg-(--teal-50)">
                <img
                  src="/mascot/expr-wave-smile.png"
                  alt=""
                  className="size-6 object-contain"
                />
              </span>
              <div className="max-w-[200px] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs leading-relaxed text-(--fg-1) shadow-(--shadow-xs)">
                やっほー！
                <br />
                何でも聞いてね〜 ✨
              </div>
            </div>
            <div className="self-end max-w-[200px] rounded-2xl rounded-br-md bg-[#7ce25a] px-3 py-2 text-xs leading-relaxed text-(--snow-900)">
              おすすめのランチは？
            </div>
            <div className="flex items-end gap-2">
              <span className="grid size-7 flex-none place-items-center overflow-hidden rounded-full bg-(--teal-50)">
                <img
                  src="/mascot/expr-content.png"
                  alt=""
                  className="size-6 object-contain"
                />
              </span>
              <div
                className="max-w-[210px] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs leading-relaxed text-(--fg-1) shadow-(--shadow-xs)"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: hardcoded
                dangerouslySetInnerHTML={{
                  __html: renderInlineBold(
                    "駅の**常盤軒**の黒いお蕎麦がおすすめ！今日はちょっと寒いから、あったかい一杯がいいかも 🥢",
                  ),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
