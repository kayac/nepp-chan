import { useEffect, useState } from "react";
import { fetchVoicePresets } from "./api";
import { TuningPanel } from "./TuningPanel";
import { toConnectParams } from "./tuning";
import { type CallStatus, useCallDevice } from "./useCallDevice";
import { useTuning } from "./useTuning";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "待機中",
  connecting: "接続中…",
  connected: "通話中",
  error: "エラー",
};

type PresetsResponse = Awaited<ReturnType<typeof fetchVoicePresets>>;

export const CallDevPage = () => {
  const { status, error, startCall, endCall } = useCallDevice();
  const [presetsData, setPresetsData] = useState<PresetsResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { values, update, reset } = useTuning(presetsData?.defaults);
  const active = status === "connecting" || status === "connected";

  useEffect(() => {
    fetchVoicePresets()
      .then(setPresetsData)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 p-6">
      <h1 className="text-xl font-bold">ねっぷちゃんと通話（dev）</h1>
      <p className="text-(--color-text)">{STATUS_LABEL[status]}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadError && (
        <p className="text-sm text-red-600">
          チューニング設定の取得に失敗しました（既定値で発信します）
        </p>
      )}
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
          onClick={() =>
            startCall(
              values && presetsData
                ? toConnectParams(values, presetsData.defaults)
                : undefined,
            )
          }
          className="rounded-full bg-emerald-500 px-8 py-3 text-white"
        >
          かける
        </button>
      )}
      {values && presetsData && (
        <TuningPanel
          values={values}
          presets={presetsData.presets}
          disabled={active}
          onChange={update}
          onReset={reset}
        />
      )}
    </main>
  );
};
