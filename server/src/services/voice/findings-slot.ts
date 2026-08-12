export type VoiceFindings = {
  query: string;
  source: "knowledge" | "web";
  text: string;
};

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
  if (findings.text.length > MAX_FINDINGS_CHARS) return;
  slot.entries.push(findings);
  const totalChars = () =>
    slot.entries.reduce((sum, entry) => sum + entry.text.length, 0);
  while (
    slot.entries.length > MAX_FINDINGS_ENTRIES ||
    totalChars() > MAX_FINDINGS_CHARS
  ) {
    slot.entries.shift();
  }
};

export type VoicePrefetch = {
  query: string;
  promise: Promise<string>;
  abort: () => void;
};

export type VoicePrefetchSlot = { current?: VoicePrefetch };

export const createVoicePrefetchSlot = (): VoicePrefetchSlot => ({});
