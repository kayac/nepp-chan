import {
  type FormEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "~/lib/class-merge";

const SAMPLE_QUESTIONS: ReadonlyArray<string> = [
  "移住の補助金はある？",
  "音威子府駅ってどんなところ？",
  "おすすめのお蕎麦屋さんは？",
  "今日のゴミの日は？",
];

const CANNED: Record<string, string> = {
  "移住の補助金はある？":
    "あるよ！音威子府村では移住者向けに、住宅取得や子育ての支援制度を用意してるんだ。たとえば **新築住宅取得補助金** や、**子育て世帯の家賃補助** なんかがあるよ。詳しくは役場の総務課で相談できるから、ねっぷちゃんから繋ぐこともできるよ〜 🏡",
  "音威子府駅ってどんなところ？":
    "音威子府駅はね、**JR宗谷本線の駅**で、村の玄関口なんだよ。村の中心部にあって、バスターミナルも併設。駅の中には名物の**「音威子府そば」**のお店もあって、真っ黒なお蕎麦が食べられるの！旅の途中にぜひ寄ってみてね 🚂✨",
  "おすすめのお蕎麦屋さんは？":
    "音威子府と言えばやっぱり**「常盤軒」**の黒いお蕎麦！駅の中にあって、観光客にも村民にも愛されてるよ。蕎麦の実を殻ごと挽いた独特の色で、香り高いのが特徴なの。お昼時は混むから、少し時間をずらすのがおすすめだよ〜 🥢",
  "今日のゴミの日は？":
    "ごめんね、今日の日付と地区が分かれば答えられるよ！ 音威子府村のゴミ収集は **地区ごとに燃えるゴミ・資源ゴミの日** が決まってるんだ。お住まいの地区を教えてくれる？💡",
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  text: "こんにちは〜！ねっぷちゃんだよ 😊\n音威子府のことなら、なんでも聞いてみてね！",
};

let messageIdCounter = 0;
const nextMessageId = () => {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
};

// `**bold**` を <strong> 要素に分解する。CANNED が hardcode のため
// 簡易マークダウンとして扱う。
const renderInlineBold = (line: string): ReactNode => {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    const key = `${i}-${part}`;
    return i % 2 === 1 ? (
      <strong key={key}>{part}</strong>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
};

/**
 * 静的版 MiniChat。後続 Issue で本物のチャットウィジェットに差し替える前提。
 */
export const MiniChat = () => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/typing 変更時にスクロール位置を最下部へ追従させたい
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setMessages((m) => [
      ...m,
      { id: nextMessageId(), role: "user", text: trimmed },
    ]);
    setInput("");
    setShowSuggestions(false);
    setTyping(true);

    // canned ヒット時は即返答、未ヒットは汎用フォールバック。
    const answer =
      CANNED[trimmed] ??
      `「${trimmed}」について調べてみるね！…ちょっと待っててね 🔍\nこのデモ版では、LINEまたはWeb版から実際のねっぷちゃんに聞いてみてね✨`;

    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextMessageId(), role: "assistant", text: answer },
      ]);
    }, 700);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex flex-col rounded-[28px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-float-md)">
      <div className="flex items-center gap-3 border-b border-(--paper-200) pb-3">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
          <img
            src="/mascot/expr-wave-smile.png"
            alt=""
            className="size-[34px] object-contain"
          />
        </span>
        <div className="flex flex-col">
          <span className="font-(family-name:--font-display) text-sm font-bold text-(--snow-800)">
            ねっぷちゃん
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-(--fg-3)">
            <span className="size-1.5 rounded-full bg-(--success)" />
            オンライン
          </span>
        </div>
        <span className="ml-auto text-(--fg-4)" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            role="presentation"
          >
            <title>menu</title>
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </span>
      </div>

      <div
        ref={streamRef}
        className="flex max-h-[280px] flex-col gap-2 overflow-y-auto py-4"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[86%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
              "animate-[lp-bubble-in_400ms_cubic-bezier(0.22,1,0.36,1)] shadow-(--shadow-float-sm)",
              m.role === "user"
                ? "self-end bg-(--teal-700) text-white"
                : "self-start bg-(--paper-50) text-(--fg-1)",
            )}
          >
            {m.text.split("\n").map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: split の行順序は固定で id 単位でユニーク
              <div key={`${m.id}-${j}`}>{renderInlineBold(line)}</div>
            ))}
          </div>
        ))}
        {typing && (
          <div className="flex max-w-[86%] items-center gap-1.5 self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3">
            {[0, 1, 2].map((dotIndex) => (
              <span
                key={`typing-dot-${dotIndex}`}
                className="size-[7px] rounded-full bg-(--teal-500) opacity-35 animate-[lp-bubble-typing_1.2s_infinite]"
                style={{ animationDelay: `${dotIndex * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={typing}
              className={cn(
                "rounded-(--r-pill) border border-(--paper-200) bg-white px-3 py-1.5 text-xs text-(--fg-2)",
                "transition-colors duration-150",
                "hover:border-(--teal-300) hover:bg-(--teal-50) hover:text-(--brand)",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          "mt-3 flex items-center gap-2 rounded-(--r-pill)",
          "border border-(--paper-200) bg-(--paper-50) px-3 py-2",
          "transition-shadow duration-200 focus-within:border-(--teal-400) focus-within:shadow-(--ring-brand)",
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="添付"
          className="grid size-7 place-items-center rounded-full text-(--fg-3) transition-colors hover:bg-(--teal-50) hover:text-(--teal-700)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            role="presentation"
          >
            <title>添付</title>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ねっぷちゃんに話しかける…"
          disabled={typing}
          className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-(--fg-4)"
        />
        <button
          type="submit"
          disabled={typing || !input.trim()}
          aria-label="送信"
          className={cn(
            "grid size-8 place-items-center rounded-full bg-(--teal-700) text-white",
            "transition-colors hover:bg-(--teal-800)",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="presentation"
          >
            <title>送信</title>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
};
