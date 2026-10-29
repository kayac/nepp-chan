import type { VoiceTurn } from "../persist-turns";

export type TranscriptEntry = {
  role: "user" | "agent";
  message?: string | null;
};

export const pairTranscriptTurns = (entries: TranscriptEntry[]) => {
  const turns: VoiceTurn[] = [];
  let pending: VoiceTurn | undefined;
  for (const entry of entries) {
    const text = entry.message?.trim();
    if (!text) continue;
    if (entry.role === "user") {
      if (pending?.assistantText) {
        turns.push(pending);
        pending = undefined;
      }
      pending = {
        userText: pending ? `${pending.userText} ${text}` : text,
        assistantText: "",
      };
      continue;
    }
    if (!pending) continue;
    pending.assistantText = pending.assistantText
      ? `${pending.assistantText} ${text}`
      : text;
  }
  if (pending?.assistantText) turns.push(pending);
  return turns;
};
