export type TranscriptRole = "user" | "assistant";

export type TranscriptFragment = {
  role: TranscriptRole;
  text: string;
  startMs?: number;
  endMs?: number;
};

// GPT-Live は相手が話している最中にも相槌を打つ。これを発話の区切りとして扱うと
// 質問の前半が切り捨てられるため、この文字数までの発話は境界にしない。
const BACKCHANNEL_MAX_CHARS = 8;

const CONTEXT_MAX_CHARS = 600;

const ROLE_LABEL: Record<TranscriptRole, string> = {
  user: "相手",
  assistant: "ねっぷ",
};

const startOf = ({ startMs, endMs }: TranscriptFragment) => startMs ?? endMs;
const endOf = ({ startMs, endMs }: TranscriptFragment) => endMs ?? startMs;

// 時刻を持たない断片は窓に配置できないため、落とさず残す。
const overlaps = (
  fragment: TranscriptFragment,
  sinceMs: number,
  untilMs: number,
) => {
  const start = startOf(fragment);
  const end = endOf(fragment);
  if (start === undefined || end === undefined) return true;
  return end > sinceMs && start < untilMs;
};

type Run = { role: TranscriptRole; text: string; endMs?: number };

const toRuns = (fragments: TranscriptFragment[]) =>
  fragments.reduce<Run[]>((runs, fragment) => {
    const last = runs.at(-1);
    if (last?.role === fragment.role) {
      last.text += fragment.text;
      last.endMs = endOf(fragment) ?? last.endMs;
      return runs;
    }
    runs.push({
      role: fragment.role,
      text: fragment.text,
      endMs: endOf(fragment),
    });
    return runs;
  }, []);

// 相槌だけの発話を除いた、直前のまとまった自分の発話の終わり。
export const lastAssistantEnd = (
  fragments: TranscriptFragment[],
  untilMs: number,
) => {
  let end = 0;
  for (const run of toRuns(fragments)) {
    if (run.role !== "assistant") continue;
    if (run.endMs === undefined || run.endMs > untilMs) continue;
    if (run.text.trim().length <= BACKCHANNEL_MAX_CHARS) continue;
    end = Math.max(end, run.endMs);
  }
  return end;
};

type ReconstructParams = {
  fragments: TranscriptFragment[];
  sinceMs: number;
  untilMs: number;
};

// delegation は質問文を持たないので、直前のまとまった発話の終わり 〜 delegation の
// offset_ms に重なる相手の文字起こし断片を繋いで復元する。
export const reconstructQuestion = ({
  fragments,
  sinceMs,
  untilMs,
}: ReconstructParams) =>
  fragments
    .filter((fragment) => fragment.role === "user")
    .filter((fragment) => overlaps(fragment, sinceMs, untilMs))
    .map((fragment) => fragment.text)
    .join("")
    .trim();

// 「うん」「木曜じゃなくて金曜」のような短い返答は単独では解釈できないため、
// 直前までのやりとりを話者付きで添える。
export const recentTranscript = (
  fragments: TranscriptFragment[],
  untilMs: number,
) => {
  const lines = toRuns(
    fragments.filter((fragment) => (startOf(fragment) ?? 0) < untilMs),
  )
    .map((run) => ({ ...run, text: run.text.trim() }))
    .filter((run) => run.text.length > 0)
    .map((run) => `${ROLE_LABEL[run.role]}: ${run.text}`);

  const kept: string[] = [];
  let chars = 0;
  for (const line of lines.reverse()) {
    if (chars + line.length > CONTEXT_MAX_CHARS) break;
    kept.unshift(line);
    chars += line.length;
  }
  return kept.join("\n");
};

// バックエンドに渡す入力。質問だけでは足りないことがあるので文脈を前置きする。
export const buildDelegationInput = (question: string, context: string) =>
  context
    ? `【通話のここまでのやりとり】\n${context}\n\n【調べてほしいこと】\n${question}`
    : question;
