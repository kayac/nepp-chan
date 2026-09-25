import { isQuestionLike } from "./filler";

export const AIZUCHI_PHRASES = ["うん", "うんうん"] as const;

const AIZUCHI_MIN_CHARS = 8;

export const pickAizuchi = (
  index: number,
  phrases: readonly string[] = AIZUCHI_PHRASES,
) => phrases[index % phrases.length];

export const shouldSendAizuchi = ({
  hasActiveTurn,
  lastAizuchiAt,
  now,
  cooldownMs,
  charsSinceLastAizuchi,
  interimText,
}: {
  hasActiveTurn: boolean;
  lastAizuchiAt: number | null;
  now: number;
  cooldownMs: number;
  charsSinceLastAizuchi: number;
  interimText: string;
}) => {
  if (hasActiveTurn) return false;
  if (isQuestionLike(interimText)) return false;
  if (charsSinceLastAizuchi < AIZUCHI_MIN_CHARS) return false;
  if (lastAizuchiAt !== null && now - lastAizuchiAt < cooldownMs) return false;
  return true;
};
