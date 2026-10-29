import {
  ConversationProvider,
  type ConversationStatus,
} from "@elevenlabs/react";
import { useElevenConversation } from "./useElevenConversation";

const STATUS_LABEL: Record<ConversationStatus, string> = {
  disconnected: "待機中",
  connecting: "接続中…",
  connected: "会話中",
  error: "エラー",
};

const MODE_LABEL = {
  speaking: "ねっぷちゃんが話しています",
  listening: "聞いています",
};

const Conversation = () => {
  const { status, mode, error, lines, start, stop } = useElevenConversation();
  const active = status === "connecting" || status === "connected";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 p-6">
      <h1 className="text-xl font-bold">ねっぷちゃんと会話（ElevenLabs）</h1>
      <p className="text-(--color-text)">
        {STATUS_LABEL[status]}
        {status === "connected" && ` / ${MODE_LABEL[mode]}`}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {active ? (
        <button
          type="button"
          onClick={stop}
          className="rounded-full bg-red-500 px-8 py-3 text-white"
        >
          切る
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-emerald-500 px-8 py-3 text-white"
        >
          話す
        </button>
      )}
      <ol className="flex w-full flex-col gap-2 text-sm">
        {lines.map((line) => (
          <li
            key={line.id}
            className={
              line.role === "user"
                ? "self-end rounded-2xl bg-(--color-surface) px-3 py-2"
                : "self-start rounded-2xl bg-emerald-50 px-3 py-2"
            }
          >
            {line.text}
          </li>
        ))}
      </ol>
    </main>
  );
};

export const CallElPage = () => (
  <ConversationProvider>
    <Conversation />
  </ConversationProvider>
);
