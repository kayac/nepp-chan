import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TuningPanel } from "./TuningPanel";

const presets = [
  {
    id: "morioki",
    label: "Morioki",
    ttsProvider: "ElevenLabs",
    voice: "8EkOjt4xTPGMclNlh1pk-flash_v2_5",
  },
  {
    id: "leda",
    label: "Leda（Google）",
    ttsProvider: "Google",
    voice: "ja-JP-Chirp3-HD-Leda",
  },
];

const baseValues = {
  voicePreset: "morioki",
  ttsProvider: "ElevenLabs",
  voice: "8EkOjt4xTPGMclNlh1pk-flash_v2_5",
  language: "ja-JP",
  ttsLanguage: "",
  transcriptionLanguage: "",
  welcomeGreeting: "もしもし",
  welcomeGreetingInterruptible: "any",
  transcriptionProvider: "Google",
  speechModel: "long",
  speechTimeout: "600",
  eotThreshold: "0.8",
  partialPrompts: "true",
  deepgramSmartFormat: "true",
  interruptible: "speech",
  interruptSensitivity: "high",
  dtmfDetection: "false",
  reportInputDuringAgentSpeech: "none",
  ignoreBackchannel: "false",
  preemptible: "false",
  hints: "音威子府",
  elevenlabsTextNormalization: "off",
  debug: "",
  fillerEnabled: "true",
  fillerDelayMs: "0",
  thinkingFillers: "えーっとね,うーんとね",
  backchannelFillers: "うんうん",
  aizuchiEnabled: "true",
  aizuchiCooldownMs: "2000",
  aizuchiPhrases: "うん,うんうん",
  holdAudioEnabled: "true",
  holdAudioUrl: "https://example.com/hold.mp3",
  holdDelayMs: "0",
  endCallEnabled: "true",
};

const setup = (overrides: Partial<typeof baseValues> = {}) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <TuningPanel
      values={{ ...baseValues, ...overrides }}
      presets={presets}
      onChange={onChange}
      onReset={onReset}
    />,
  );
  return { onChange, onReset };
};

describe("TuningPanel", () => {
  it("プリセット選択で voicePreset と ttsProvider/voice をまとめて変更する", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("プリセット"), {
      target: { value: "leda" },
    });
    expect(onChange).toHaveBeenCalledWith({
      voicePreset: "leda",
      ttsProvider: "Google",
      voice: "ja-JP-Chirp3-HD-Leda",
    });
  });

  it("ElevenLabs のときだけ voiceId・TTS モデルの詳細を表示する", () => {
    setup();
    expect(screen.getByLabelText("voiceId")).toBeInTheDocument();
    expect(screen.getByLabelText("TTS モデル")).toBeInTheDocument();
  });

  it("Google のときは ElevenLabs 詳細を出さず voice を直接編集できる", () => {
    setup({ ttsProvider: "Google", voice: "ja-JP-Chirp3-HD-Leda" });
    expect(screen.queryByLabelText("voiceId")).not.toBeInTheDocument();
    expect(screen.getByLabelText("voice")).toHaveValue("ja-JP-Chirp3-HD-Leda");
  });

  it("音声詳細の適用で speed/stability/similarity 付きの voice を合成する", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText("速度・安定性・類似度を指定"));
    expect(onChange).toHaveBeenCalledWith({
      voice: "8EkOjt4xTPGMclNlh1pk-flash_v2_5-1.0_0.5_0.75",
    });
  });

  it("ElevenLabs へ切り替えると voice をプリセットの声に差し替える", () => {
    const { onChange } = setup({
      ttsProvider: "Google",
      voice: "ja-JP-Chirp3-HD-Leda",
    });
    fireEvent.change(screen.getByLabelText("ttsProvider"), {
      target: { value: "ElevenLabs" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ttsProvider: "ElevenLabs",
      voice: "8EkOjt4xTPGMclNlh1pk-flash_v2_5",
    });
  });

  it("Deepgram のときだけ eotThreshold と smart format を表示する", () => {
    setup();
    expect(screen.queryByLabelText("eotThreshold")).not.toBeInTheDocument();
    setup({ transcriptionProvider: "Deepgram" });
    expect(screen.getByLabelText("eotThreshold")).toBeInTheDocument();
    expect(screen.getByLabelText("スマートフォーマット")).toBeInTheDocument();
  });

  it("speechTimeout の auto 切り替えができる", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText("auto"));
    expect(onChange).toHaveBeenCalledWith({ speechTimeout: "auto" });
  });

  it("チェックボックスは true/false 文字列で onChange する", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText("フィラー発話"));
    expect(onChange).toHaveBeenCalledWith({ fillerEnabled: "false" });
  });

  it("自動終話のトグルを true/false 文字列で onChange する", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText("自動で電話を切る"));
    expect(onChange).toHaveBeenCalledWith({ endCallEnabled: "false" });
  });

  it("あいづち文言をカンマ区切りのまま onChange する", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("あいづち文言"), {
      target: { value: "はい,ええ" },
    });
    expect(onChange).toHaveBeenCalledWith({ aizuchiPhrases: "はい,ええ" });
  });

  it("disabled のとき入力とリセットが無効になる", () => {
    const onReset = vi.fn();
    render(
      <TuningPanel
        values={baseValues}
        presets={presets}
        disabled
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );
    expect(screen.getByLabelText("プリセット")).toBeDisabled();
    expect(screen.getByRole("button", { name: "既定値に戻す" })).toBeDisabled();
  });

  it("リセットボタンで onReset を呼ぶ", () => {
    const { onReset } = setup();
    fireEvent.click(screen.getByRole("button", { name: "既定値に戻す" }));
    expect(onReset).toHaveBeenCalled();
  });
});
