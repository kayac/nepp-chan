import { Mascot } from "@nepp-chan/shared/components/Mascot";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { SendIcon } from "lucide-react";
import { type SubmitEvent, useState } from "react";

const QUICK_PROMPTS: ReadonlyArray<{ icon: string; text: string }> = [
  { icon: "🧭", text: "音威子府村って、どんなところ？" },
  { icon: "🍜", text: "名物の黒いお蕎麦について教えて" },
  { icon: "🎨", text: "砂澤ビッキ記念館は？" },
  { icon: "❄️", text: "冬の楽しみ方を教えて" },
];

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

/**
 * 初回訪問時に表示する Landing 画面。
 * クイックプロンプトのタップ or テキスト送信で会話開始。
 * AssistantProvider 外で動くため、Composer は素の <form> + <input>。
 */
export const Landing = ({ onSubmit, disabled = false }: Props) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSubmit(t);
    setText("");
  };

  const handlePromptTap = (prompt: string) => {
    if (disabled) return;
    onSubmit(prompt);
  };

  return (
    <div className="relative z-[2] flex-1 flex flex-col items-center px-4 pt-6 pb-8 overflow-y-auto">
      <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center gap-8 py-8">
        <div className="text-xs text-(--fg-3) tracking-[0.28em] uppercase flex items-center gap-2.5">
          <span aria-hidden="true">❄</span>
          <span>OTOINEPPU · AI MAYOR</span>
          <span aria-hidden="true">❄</span>
        </div>

        <h1 className="font-(family-name:--font-display) font-black text-2xl sm:text-3xl md:text-4xl text-center text-(--snow-800) tracking-tight leading-tight">
          <span className="inline-block">音威子府村を</span>
          <em className="not-italic text-(--brand) whitespace-nowrap">
            ねっぷちゃん
          </em>
          <span className="inline-block">と</span>
          <br />
          <span className="inline-block">お散歩しよう</span>
          <span aria-hidden="true" className="ml-2">
            ✨
          </span>
        </h1>

        <p className="text-base text-(--fg-2) text-center leading-relaxed max-w-md whitespace-pre-line">
          {
            "自然・文化・グルメ・アクティビティ —\n村のことなら、ねっぷちゃんが道しるべ。"
          }
        </p>

        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full">
          <div className="flex-1 flex flex-col gap-2 w-full md:max-w-md">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.text}
                type="button"
                onClick={() => handlePromptTap(p.text)}
                disabled={disabled}
                className={cn(
                  "w-full text-left flex items-center gap-2.5",
                  "rounded-full border border-(--paper-200) bg-(--paper-0)",
                  "px-4 py-2.5 text-sm text-(--snow-700) font-medium",
                  "transition-colors hover:border-(--teal-300) hover:text-(--teal-700)",
                  "shadow-(--shadow-float-sm)",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                <span aria-hidden="true">{p.icon}</span>
                <span>{p.text}</span>
              </button>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="w-[200px] md:w-[260px] aspect-[3/4] flex-none"
          >
            <Mascot
              expression="normal"
              showHalo={false}
              floating={true}
              alt="ねっぷちゃん"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={cn(
            "w-full max-w-xl mt-2",
            "flex items-center gap-2",
            "rounded-(--r-footer) border-2 border-(--teal-500) bg-(--paper-0)",
            "px-5 py-2.5",
          )}
          style={{ boxShadow: "var(--shadow-floating-input)" }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder="話しかけてみる…"
            aria-label="メッセージ入力"
            className={cn(
              "flex-1 bg-transparent border-0 outline-none",
              "px-1 py-2 text-base text-(--fg-1) placeholder:text-(--fg-4) leading-snug",
            )}
          />
          <button
            type="submit"
            aria-label="送信"
            disabled={disabled || !text.trim()}
            className={cn(
              "size-10 rounded-full grid place-items-center flex-none",
              "bg-(--teal-700) text-(--paper-0)",
              "transition-colors hover:bg-(--teal-800)",
              "disabled:bg-(--paper-100) disabled:text-(--fg-4) disabled:cursor-not-allowed",
            )}
            style={{ boxShadow: "0 4px 12px rgba(15, 118, 110, 0.35)" }}
          >
            <SendIcon className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
};
