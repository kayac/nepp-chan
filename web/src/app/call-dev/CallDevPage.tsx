import { useEffect, useState } from "react";
import { fetchVoicePresets } from "./api";
import { type CallStatus, useCallDevice } from "./useCallDevice";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "待機中",
  connecting: "接続中…",
  connected: "通話中",
  error: "エラー",
};

type VoicePreset = Awaited<
  ReturnType<typeof fetchVoicePresets>
>["presets"][number];

export const CallDevPage = () => {
  const { status, error, startCall, endCall } = useCallDevice();
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [voicePreset, setVoicePreset] = useState<string>();
  const active = status === "connecting" || status === "connected";

  useEffect(() => {
    fetchVoicePresets()
      .then(({ defaultId, presets }) => {
        setPresets(presets);
        setVoicePreset(defaultId);
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-bold">ねっぷちゃんと通話（dev）</h1>
      {presets.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          ボイス
          <select
            value={voicePreset}
            onChange={(e) => setVoicePreset(e.target.value)}
            disabled={active}
            className="rounded border border-stone-300 bg-white px-3 py-2"
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      )}
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
          onClick={() => startCall(voicePreset)}
          className="rounded-full bg-emerald-500 px-8 py-3 text-white"
        >
          かける
        </button>
      )}
    </main>
  );
};
