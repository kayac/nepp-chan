export const AIZUCHI_PHRASES = ["うん", "うんうん"] as const;

export const pickAizuchi = (
  index: number,
  phrases: readonly string[] = AIZUCHI_PHRASES,
) => phrases[index % phrases.length];

export const shouldSendAizuchi = ({
  hasActiveTurn,
  lastAizuchiAt,
  now,
  cooldownMs,
}: {
  hasActiveTurn: boolean;
  lastAizuchiAt: number | null;
  now: number;
  cooldownMs: number;
}) => {
  if (hasActiveTurn) return false;
  if (lastAizuchiAt !== null && now - lastAizuchiAt < cooldownMs) return false;
  return true;
};
