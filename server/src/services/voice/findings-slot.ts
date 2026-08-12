export type VoiceFindings = {
  query: string;
  source: "knowledge" | "web";
  text: string;
};

// 通話1回分の検索結果をすべて貯め、以後のターンは資料から検索なしで答える。
// 全件が要点化プロンプトに入るため、件数と総文字数で古いものから捨てる。
export type VoiceFindingsSlot = { entries: VoiceFindings[] };

const MAX_FINDINGS_ENTRIES = 8;
const MAX_FINDINGS_CHARS = 4000;

export const createVoiceFindingsSlot = (): VoiceFindingsSlot => ({
  entries: [],
});

export const hasVoiceFindings = (slot: VoiceFindingsSlot | undefined) =>
  (slot?.entries.length ?? 0) > 0;

export const pushVoiceFindings = (
  slot: VoiceFindingsSlot,
  findings: VoiceFindings,
) => {
  slot.entries.push(findings);
  const totalChars = () =>
    slot.entries.reduce((sum, entry) => sum + entry.text.length, 0);
  while (
    slot.entries.length > 1 &&
    (slot.entries.length > MAX_FINDINGS_ENTRIES ||
      totalChars() > MAX_FINDINGS_CHARS)
  ) {
    slot.entries.shift();
  }
};

// 親エージェントがツールを呼ぶと決める前に走らせる投機検索。
// 資料が使われず捨てられたときに打ち切れるよう abort を持つ。
export type VoicePrefetch = {
  query: string;
  promise: Promise<string>;
  abort: () => void;
};

export type VoicePrefetchSlot = { current?: VoicePrefetch };

export const createVoicePrefetchSlot = (): VoicePrefetchSlot => ({});
