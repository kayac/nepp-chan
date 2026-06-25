import { type CallStatus, useCallDevice } from "./useCallDevice";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "待機中",
  connecting: "接続中…",
  connected: "通話中",
  error: "エラー",
};

export const CallDevPage = () => {
  const { status, error, startCall, endCall } = useCallDevice();
  const active = status === "connecting" || status === "connected";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-bold">ねっぷちゃんと通話（dev）</h1>
      <p className="text-(--color-text)">{STATUS_LABEL[status]}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {active ? (
        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-red-500 px-8 py-3 text-white"
        >
          切る
        </button>
      ) : (
        <button
          type="button"
          onClick={startCall}
          className="rounded-full bg-emerald-500 px-8 py-3 text-white"
        >
          かける
        </button>
      )}
    </main>
  );
};
