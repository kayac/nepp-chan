export type VoiceFindings = {
  query: string;
  source: "knowledge" | "web";
  text: string;
};

export type VoiceFindingsSlot = { current?: VoiceFindings };

export const createVoiceFindingsSlot = (): VoiceFindingsSlot => ({});
