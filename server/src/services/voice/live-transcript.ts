export type TranscriptFragment = {
  text: string;
  startMs?: number;
  endMs?: number;
};

type ReconstructParams = {
  fragments: TranscriptFragment[];
  sinceMs: number;
  untilMs: number;
};

// 時刻を持たない断片は窓に配置できないため、落とさず残す。
const inWindow = (
  { startMs, endMs }: TranscriptFragment,
  sinceMs: number,
  untilMs: number,
) => {
  const start = startMs ?? endMs;
  const end = endMs ?? startMs;
  if (start === undefined || end === undefined) return true;
  return end > sinceMs && start < untilMs;
};

// delegation は質問文を持たないので、直前の自分の発話の終わり 〜 delegation の
// offset_ms に重なる文字起こし断片を繋いで復元する。
export const reconstructQuestion = ({
  fragments,
  sinceMs,
  untilMs,
}: ReconstructParams) =>
  fragments
    .filter((fragment) => inWindow(fragment, sinceMs, untilMs))
    .map((fragment) => fragment.text)
    .join("")
    .trim();
