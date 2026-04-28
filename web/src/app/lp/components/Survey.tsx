import { useState } from "react";
import { useScrollReveal } from "~/hooks/useScrollReveal";
import { cn } from "~/lib/class-merge";

const OPTIONS: ReadonlyArray<string> = [
  "除雪の頻度や範囲",
  "子育て・教育のこと",
  "お店や飲食店の充実",
  "イベントや交流",
];

export const Survey = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const visual = useScrollReveal<HTMLDivElement>();
  const body = useScrollReveal<HTMLDivElement>();

  return (
    <div className="grid items-center gap-10 py-12 md:grid-cols-2 md:gap-20 md:py-20">
      <div
        ref={visual.ref}
        data-revealed={visual.revealed}
        className="opacity-0 translate-y-3 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0"
      >
        <div className="rounded-[28px] border border-(--paper-200) bg-white p-6 shadow-(--shadow-float-md)">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
              <img
                src="/mascot/expr-surprise.png"
                alt=""
                className="size-[30px] object-contain"
              />
            </span>
            <span className="rounded-(--r-pill) bg-(--apricot-50) px-3 py-1 text-xs font-medium text-(--apricot-700)">
              ねっぷちゃんからの質問
            </span>
          </div>
          <p className="mt-4 font-(family-name:--font-display) text-base font-bold leading-[1.6] text-(--snow-800)">
            来年度、村でいちばん力を入れてほしいのはどれ？
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {OPTIONS.map((option, i) => {
              const isSelected = selected === i;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    isSelected
                      ? "border-(--brand) bg-(--brand-soft) text-(--fg-1)"
                      : "border-(--paper-200) bg-(--paper-50) text-(--fg-2) hover:border-(--teal-300)",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 flex-none place-items-center rounded-full border-2",
                      isSelected
                        ? "border-(--brand) bg-(--brand)"
                        : "border-(--paper-200) bg-white",
                    )}
                  >
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-(--fg-3)">
            <span>所要時間: 約30秒</span>
            <button
              type="button"
              disabled={selected === null}
              className="rounded-(--r-pill) bg-(--brand) px-4 py-2 text-xs font-bold text-white shadow-(--shadow-brand) transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              回答する
            </button>
          </div>
        </div>
      </div>

      <div
        ref={body.ref}
        data-revealed={body.revealed}
        className="opacity-0 translate-y-3 transition-all delay-200 duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0 md:order-2"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
          <span className="grid size-6 place-items-center rounded-full bg-(--teal-700) text-[12px] text-white">
            4
          </span>
          VOICE
        </div>
        <h3 className="mt-4 font-(family-name:--font-display) text-[clamp(24px,3.5vw,34px)] font-bold leading-[1.35] text-(--snow-800)">
          たまに
          <br />
          アンケートも
          <br />
          届くよ！
        </h3>
        <p className="mt-5 text-base leading-[1.85] text-(--fg-1)">
          ねっぷちゃんから、ときどき質問が届きます。
          <br />
          気が向いたら、気軽に答えてみてね！
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-2)">
          あなたのひとことが、村の明日につながるかも。みんなのことが、ちゃんと届く村に。ねっぷちゃんが橋渡しします。
        </p>
        <p className="mt-3 text-base leading-[1.85] text-(--fg-1)">
          <strong>村のみんなとねっぷちゃんで、ワイワイ楽しもう！</strong>
        </p>
      </div>
    </div>
  );
};
