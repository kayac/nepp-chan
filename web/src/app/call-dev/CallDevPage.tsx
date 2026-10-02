import {
  DEFAULT_LIVE_VOICE,
  LIVE_VOICES,
} from "@nepp-chan/shared/constants/live-voices";
import { useEffect, useId, useState } from "react";
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
  const [useLiveEngine, setUseLiveEngine] = useState(false);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [liveVoice, setLiveVoice] = useState<string>(DEFAULT_LIVE_VOICE);
  const engineToggleId = useId();
  const knowledgeToggleId = useId();
  const voiceSelectId = useId();
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
              useLiveEngine
                ? {
                    engine: "live",
                    knowledge: String(useKnowledge),
                    liveVoice,
                  }
                : values && presetsData
                  ? toConnectParams(values, presetsData.defaults)
                  : {},
            )
          }
          className="rounded-full bg-emerald-500 px-8 py-3 text-white"
        >
          かける
        </button>
      )}
      <label
        htmlFor={engineToggleId}
        className="flex items-center gap-2 text-sm"
      >
        <input
          id={engineToggleId}
          type="checkbox"
          checked={useLiveEngine}
          disabled={active}
          onChange={(e) => setUseLiveEngine(e.target.checked)}
        />
        GPT-Live で通話する
      </label>
      <label
        htmlFor={knowledgeToggleId}
        className="flex items-center gap-2 text-sm"
      >
        <input
          id={knowledgeToggleId}
          type="checkbox"
          checked={useKnowledge}
          disabled={active || !useLiveEngine}
          onChange={(e) => setUseKnowledge(e.target.checked)}
        />
        ナレッジを使う（OFF なら GPT-Live 自身の知識だけで答える）
      </label>
      <label
        htmlFor={voiceSelectId}
        className="flex items-center gap-2 text-sm"
      >
        GPT-Live の声
        <select
          id={voiceSelectId}
          value={liveVoice}
          disabled={active || !useLiveEngine}
          onChange={(e) => setLiveVoice(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1 disabled:bg-stone-100"
        >
          {LIVE_VOICES.map((voice) => (
            <option key={voice} value={voice}>
              {voice}
            </option>
          ))}
        </select>
      </label>
      {useLiveEngine && (
        <p className="self-start text-sm text-stone-500">
          以下の設定は ConversationRelay 経路のものなので、GPT-Live
          では使われません
        </p>
      )}
      {values && presetsData && (
        <TuningPanel
          values={values}
          presets={presetsData.presets}
          disabled={active || useLiveEngine}
          onChange={update}
          onReset={reset}
        />
      )}
    </main>
  );
};
