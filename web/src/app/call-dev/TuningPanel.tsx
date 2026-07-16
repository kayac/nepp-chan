import { useId } from "react";
import {
  buildElevenLabsVoice,
  parseElevenLabsVoice,
  type TuningValues,
} from "./tuning";

type Preset = {
  id: string;
  label: string;
  ttsProvider: string;
  voice: string;
};

type Props = {
  values: TuningValues;
  presets: Preset[];
  disabled?: boolean;
  onChange: (patch: TuningValues) => void;
  onReset: () => void;
};

type Option = { value: string; label: string };

const opts = (options: string[]): Option[] =>
  options.map((value) => ({ value, label: value }));

const INTERRUPTION_OPTIONS = opts(["none", "dtmf", "speech", "any"]);
const ELEVENLABS_MODEL_OPTIONS = opts([
  "flash_v2_5",
  "turbo_v2_5",
  "multilingual_v2",
]);

const inputClass =
  "min-w-0 rounded border border-stone-300 bg-white px-2 py-1 disabled:bg-stone-100";
const rowClass = "flex items-center justify-between gap-3 text-sm";

const RowLabel = ({
  htmlFor,
  label,
  hint,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
}) => (
  <span className="flex flex-col">
    <label htmlFor={htmlFor}>{label}</label>
    {hint && <span className="text-xs text-stone-400">{hint}</span>}
  </span>
);

const SelectRow = ({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className={rowClass}>
      <RowLabel htmlFor={id} label={label} hint={hint} />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const TextRow = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className={rowClass}>
      <RowLabel htmlFor={id} label={label} hint={hint} />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-48 shrink-0`}
      />
    </div>
  );
};

const CheckRow = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  const id = useId();
  return (
    <div className={rowClass}>
      <RowLabel htmlFor={id} label={label} hint={hint} />
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0"
      />
    </div>
  );
};

const NumberRow = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className={rowClass}>
      <RowLabel htmlFor={id} label={label} hint={hint} />
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-28 shrink-0`}
      />
    </div>
  );
};

const RangeRow = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className={rowClass}>
      <RowLabel htmlFor={id} label={label} hint={hint} />
      <span className="flex shrink-0 items-center gap-2">
        <input
          id={id}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="w-10 text-right tabular-nums">{value}</span>
      </span>
    </div>
  );
};

const Section = ({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => (
  <details
    open={defaultOpen}
    className="rounded-lg border border-stone-200 bg-white/70 px-4 py-3"
  >
    <summary className="cursor-pointer text-sm font-bold">{title}</summary>
    <div className="mt-3 flex flex-col gap-2.5">{children}</div>
  </details>
);

export const TuningPanel = ({
  values,
  presets,
  disabled,
  onChange,
  onReset,
}: Props) => {
  const v = (key: string) => values[key] ?? "";
  const boolRow = (label: string, key: string, hint?: string) => (
    <CheckRow
      label={label}
      hint={hint}
      checked={v(key) === "true"}
      onChange={(checked) => onChange({ [key]: String(checked) })}
    />
  );

  const isElevenLabs = v("ttsProvider") === "ElevenLabs";
  const isDeepgram = v("transcriptionProvider") === "Deepgram";
  const voiceParts = parseElevenLabsVoice(v("voice"));
  const hasVoiceSettings = voiceParts.speed !== undefined;
  const patchVoice = (next: Partial<typeof voiceParts>) =>
    onChange({ voice: buildElevenLabsVoice({ ...voiceParts, ...next }) });

  return (
    <fieldset disabled={disabled} className="flex w-full flex-col gap-3">
      <Section title="ボイス（TTS）" defaultOpen>
        <SelectRow
          label="プリセット"
          hint="声とプロバイダの組み合わせを一括で切り替える"
          value={v("voicePreset")}
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(id) => {
            const preset = presets.find((p) => p.id === id);
            if (!preset) return;
            onChange({
              voicePreset: id,
              ttsProvider: preset.ttsProvider,
              voice: preset.voice,
            });
          }}
        />
        <SelectRow
          label="ttsProvider"
          hint="音声合成エンジン"
          value={v("ttsProvider")}
          options={opts(["ElevenLabs", "Google", "Amazon"])}
          onChange={(value) => {
            // 非 ElevenLabs の voice 文字列は分解できないため、切り替え時はプリセットの声に差し替える。
            const elevenLabsVoice =
              value === "ElevenLabs" && !isElevenLabs
                ? presets.find((p) => p.ttsProvider === "ElevenLabs")?.voice
                : undefined;
            onChange({
              ttsProvider: value,
              ...(elevenLabsVoice && { voice: elevenLabsVoice }),
            });
          }}
        />
        {isElevenLabs ? (
          <>
            <TextRow
              label="voiceId"
              hint="ElevenLabs の音声 ID"
              value={voiceParts.voiceId}
              onChange={(voiceId) => patchVoice({ voiceId })}
            />
            <SelectRow
              label="TTS モデル"
              hint="flash は低遅延、multilingual は品質重視"
              value={voiceParts.model ?? ""}
              options={ELEVENLABS_MODEL_OPTIONS}
              onChange={(model) => patchVoice({ model })}
            />
            <CheckRow
              label="速度・安定性・類似度を指定"
              hint="on にすると音声設定を voice 文字列に付加する"
              checked={hasVoiceSettings}
              onChange={(checked) =>
                checked
                  ? patchVoice({
                      model: voiceParts.model ?? "flash_v2_5",
                      speed: "1.0",
                      stability: "0.5",
                      similarity: "0.75",
                    })
                  : onChange({
                      voice: buildElevenLabsVoice({
                        voiceId: voiceParts.voiceId,
                        model: voiceParts.model,
                      }),
                    })
              }
            />
            {hasVoiceSettings && (
              <>
                <RangeRow
                  label="速度"
                  value={voiceParts.speed ?? "1.0"}
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  onChange={(speed) => patchVoice({ speed })}
                />
                <RangeRow
                  label="安定性"
                  hint="低いほど抑揚が豊かで不安定になる"
                  value={voiceParts.stability ?? "0.5"}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(stability) => patchVoice({ stability })}
                />
                <RangeRow
                  label="類似度"
                  hint="元音声への忠実度"
                  value={voiceParts.similarity ?? "0.75"}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(similarity) => patchVoice({ similarity })}
                />
              </>
            )}
            <p className="break-all text-xs text-stone-500">
              voice: {v("voice")}
            </p>
            <SelectRow
              label="テキスト正規化"
              hint="数字・記号の読み方を整える（ElevenLabs）"
              value={v("elevenlabsTextNormalization")}
              options={opts(["off", "auto", "on"])}
              onChange={(value) =>
                onChange({ elevenlabsTextNormalization: value })
              }
            />
          </>
        ) : (
          <TextRow
            label="voice"
            hint="プロバイダの音声名（例: ja-JP-Chirp3-HD-Leda）"
            value={v("voice")}
            onChange={(value) => onChange({ voice: value })}
          />
        )}
        <TextRow
          label="language"
          hint="通話全体の言語（STT/TTS 共通）"
          value={v("language")}
          onChange={(value) => onChange({ language: value })}
        />
        <TextRow
          label="ttsLanguage"
          hint="読み上げだけ別言語にする場合に指定"
          value={v("ttsLanguage")}
          onChange={(value) => onChange({ ttsLanguage: value })}
        />
      </Section>

      <Section title="音声認識（STT）">
        <SelectRow
          label="transcriptionProvider"
          hint="音声認識エンジン"
          value={v("transcriptionProvider")}
          options={opts(["Google", "Deepgram"])}
          onChange={(value) => onChange({ transcriptionProvider: value })}
        />
        <TextRow
          label="speechModel"
          hint="認識モデル（Google: long / Deepgram: nova-2 等）"
          value={v("speechModel")}
          onChange={(value) => onChange({ speechModel: value })}
        />
        <TextRow
          label="transcriptionLanguage"
          hint="認識だけ別言語にする場合に指定"
          value={v("transcriptionLanguage")}
          onChange={(value) => onChange({ transcriptionLanguage: value })}
        />
        <TextRow
          label="hints"
          hint="優先的に認識させたい語句（カンマ区切り）"
          value={v("hints")}
          onChange={(value) => onChange({ hints: value })}
        />
        <CheckRow
          label="auto"
          hint="発話終端の検出を Twilio に任せる"
          checked={v("speechTimeout") === "auto"}
          onChange={(checked) =>
            onChange({ speechTimeout: checked ? "auto" : "600" })
          }
        />
        <NumberRow
          label="speechTimeout(ms)"
          hint="この長さ無音が続いたら発話を確定する"
          value={v("speechTimeout") === "auto" ? "" : v("speechTimeout")}
          min={600}
          max={5000}
          step={100}
          disabled={v("speechTimeout") === "auto"}
          onChange={(value) => onChange({ speechTimeout: value })}
        />
        {isDeepgram && (
          <>
            <RangeRow
              label="eotThreshold"
              hint="発話終端と判定する確信度。高いほど確定を待つ"
              value={v("eotThreshold")}
              min={0.5}
              max={0.9}
              step={0.05}
              onChange={(value) => onChange({ eotThreshold: value })}
            />
            {boolRow(
              "スマートフォーマット",
              "deepgramSmartFormat",
              "数字・日付などの表記を整える（Deepgram）",
            )}
          </>
        )}
      </Section>

      <Section title="対話制御">
        <TextRow
          label="開始の挨拶"
          hint="接続直後の第一声。空にすると挨拶なし"
          value={v("welcomeGreeting")}
          onChange={(value) => onChange({ welcomeGreeting: value })}
        />
        <SelectRow
          label="挨拶の割り込み"
          hint="挨拶中のユーザー発話・DTMF で挨拶を中断するか"
          value={v("welcomeGreetingInterruptible")}
          options={INTERRUPTION_OPTIONS}
          onChange={(value) =>
            onChange({ welcomeGreetingInterruptible: value })
          }
        />
        <SelectRow
          label="interruptible"
          hint="AI の発話中にユーザーが話すと発話を止める（barge-in）"
          value={v("interruptible")}
          options={INTERRUPTION_OPTIONS}
          onChange={(value) => onChange({ interruptible: value })}
        />
        <SelectRow
          label="割り込み感度"
          hint="low ほど雑音や小声で途切れにくくなる"
          value={v("interruptSensitivity")}
          options={opts(["high", "medium", "low"])}
          onChange={(value) => onChange({ interruptSensitivity: value })}
        />
        <SelectRow
          label="発話中の入力通知"
          hint="割り込まずに発話中の入力をサーバへ届ける"
          value={v("reportInputDuringAgentSpeech")}
          options={INTERRUPTION_OPTIONS}
          onChange={(value) =>
            onChange({ reportInputDuringAgentSpeech: value })
          }
        />
        {boolRow(
          "相槌を無視（backchannel）",
          "ignoreBackchannel",
          "「うん」「はい」等を割り込みとして扱わない",
        )}
        {boolRow(
          "preemptible",
          "preemptible",
          "新しい発話が再生中の音声を置き換えられる",
        )}
        {boolRow("DTMF 検出", "dtmfDetection", "プッシュ音をサーバに通知する")}
        {boolRow(
          "partialPrompts",
          "partialPrompts",
          "確定前の中間認識も送る。off だとあいづちが動かない",
        )}
        <TextRow
          label="debug"
          hint="Twilio のデバッグメッセージを購読する"
          value={v("debug")}
          onChange={(value) => onChange({ debug: value })}
        />
      </Section>

      <Section title="サーバ挙動">
        {boolRow(
          "フィラー発話",
          "fillerEnabled",
          "応答生成を待つ間「えーっとね」等で沈黙を埋める",
        )}
        <NumberRow
          label="フィラー遅延(ms)"
          hint="この時間内に応答が始まればフィラーを省略。0 で即時"
          value={v("fillerDelayMs")}
          min={0}
          max={5000}
          step={100}
          onChange={(value) => onChange({ fillerDelayMs: value })}
        />
        <TextRow
          label="考え中フィラー"
          hint="質問への一言（カンマ区切り・各20文字まで）"
          value={v("thinkingFillers")}
          onChange={(value) => onChange({ thinkingFillers: value })}
        />
        <TextRow
          label="相槌フィラー"
          hint="雑談への一言（カンマ区切り）"
          value={v("backchannelFillers")}
          onChange={(value) => onChange({ backchannelFillers: value })}
        />
        {boolRow(
          "あいづち",
          "aizuchiEnabled",
          "ユーザーの発話中に「うん」を挟む",
        )}
        <NumberRow
          label="あいづち最短間隔(ms)"
          hint="連発を防ぐ間隔。時間での定期発話ではない"
          value={v("aizuchiCooldownMs")}
          min={500}
          max={30000}
          step={500}
          onChange={(value) => onChange({ aizuchiCooldownMs: value })}
        />
        <TextRow
          label="あいづち文言"
          hint="カンマ区切りで順に使う"
          value={v("aizuchiPhrases")}
          onChange={(value) => onChange({ aizuchiPhrases: value })}
        />
        {boolRow(
          "保留音",
          "holdAudioEnabled",
          "ナレッジ検索などの待ち時間に音楽を流す",
        )}
        <NumberRow
          label="保留音遅延(ms)"
          hint="検索開始から指定時間待つ。最短3秒後に開始"
          value={v("holdDelayMs")}
          min={0}
          max={5000}
          step={100}
          onChange={(value) => onChange({ holdDelayMs: value })}
        />
        <TextRow
          label="保留音 URL"
          hint="https の音源 URL"
          value={v("holdAudioUrl")}
          onChange={(value) => onChange({ holdAudioUrl: value })}
        />
        {boolRow(
          "自動で電話を切る",
          "endCallEnabled",
          "お別れの挨拶を検知したら AI が通話を終了する",
        )}
      </Section>

      <button
        type="button"
        onClick={onReset}
        className="self-end rounded border border-stone-300 px-4 py-1.5 text-sm disabled:opacity-50"
      >
        既定値に戻す
      </button>
    </fieldset>
  );
};
