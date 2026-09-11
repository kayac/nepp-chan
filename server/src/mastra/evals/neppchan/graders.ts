import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { createScorer } from "@mastra/core/evals";
import { roundToTwoDecimals } from "@mastra/evals/scorers/utils";
import {
  casualEndingCount,
  countChars,
  countEmoji,
  emojiPer100,
  exclamationShare,
  framingSentenceCount,
  hasBrightEmoji,
  hasBullets,
  hasHeadings,
  hasMarkdown,
  hasNumberedList,
  hasPlaceholderName,
  identityClaims,
  internalNames,
  latinRatio,
  listItemCount,
  longestPeriodRun,
  markdownLinkCount,
  politeEndingCount,
  rawUrlCount,
  readingAnnotations,
  reportTonePhrases,
  sentences,
  serviceClosingPhrases,
  styleMetrics,
  timeTokenCount,
} from "./text";

type PartLike = { type?: string; toolInvocation?: { toolName?: string } };
type ContentLike = {
  parts?: PartLike[];
  toolInvocations?: { toolName?: string }[];
};

// 検索前の前置きと最終回答は 1 つの assistant メッセージ内の別 text part に入る。
// getTextContentFromMastraDBMessage は最後の part しか返さないので、part 単位で集める
const assistantTextParts = (output: ScorerRunOutputForAgent) =>
  output
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.content.parts ?? [])
    .flatMap((p) => (p.type === "text" ? [p.text.trim()] : []))
    .filter(Boolean);

export const responseText = (output: ScorerRunOutputForAgent) =>
  assistantTextParts(output).join("\n\n");

export const finalResponseText = (output: ScorerRunOutputForAgent) =>
  assistantTextParts(output).at(-1) ?? "";

export const preambleText = (output: ScorerRunOutputForAgent) =>
  assistantTextParts(output).slice(0, -1).join("\n\n");

export const calledTools = (output: ScorerRunOutputForAgent) => {
  const names = new Set<string>();
  for (const m of output) {
    const content = m.content as ContentLike;
    for (const p of content.parts ?? []) {
      if (p.type === "tool-invocation" && p.toolInvocation?.toolName) {
        names.add(p.toolInvocation.toolName);
      } else if (p.type?.startsWith("tool-") && p.type !== "tool-invocation") {
        names.add(p.type.slice("tool-".length));
      }
    }
    for (const t of content.toolInvocations ?? []) {
      if (t.toolName) names.add(t.toolName);
    }
  }
  return [...names];
};

type Check = (
  text: string,
  output: ScorerRunOutputForAgent,
) => {
  pass: boolean;
  detail: string;
};

type Scope = "final" | "all";

const codeGrader = (
  id: string,
  description: string,
  check: Check,
  scope: Scope = "final",
) =>
  createScorer({ id: `code:${id}`, description, type: "agent" })
    .preprocess(({ run }) => {
      const text =
        scope === "all"
          ? responseText(run.output)
          : finalResponseText(run.output);
      return { text, ...check(text, run.output) };
    })
    .generateScore(({ results }) => (results.preprocessStepResult.pass ? 1 : 0))
    .generateReason(({ results }) => results.preprocessStepResult.detail);

export const emojiDensity = ({
  min = 1.0,
  shortMin = 2,
}: {
  min?: number;
  shortMin?: number;
} = {}) =>
  codeGrader(
    "emoji-density",
    "絵文字が、らしい返答の実例と同じくらい以上ある",
    (text) => {
      const chars = countChars(text);
      const count = countEmoji(text);
      if (chars < 120) {
        return {
          pass: count >= shortMin,
          detail: `短文: 絵文字 ${count} 個（下限 ${shortMin}）`,
        };
      }
      const density = emojiPer100(text);
      return {
        pass: density >= min,
        detail: `100字あたり ${roundToTwoDecimals(density)} 個（下限 ${min}）`,
      };
    },
  );

export const noPeriodRun = (maxRun = 2) =>
  codeGrader("no-period-run", "「。」で終わる文が連続しない", (text) => {
    const run = longestPeriodRun(text);
    return {
      pass: run <= maxRun,
      detail: `「。」連続 ${run} 文（上限 ${maxRun}）`,
    };
  });

export const endingMix = (minExclamation = 0.15) =>
  codeGrader("ending-mix", "「！」で終わる文が一定割合ある", (text) => {
    const share = exclamationShare(text);
    return {
      pass: share >= minExclamation,
      detail: `「！」止め ${(share * 100).toFixed(0)}%（下限 ${minExclamation * 100}%）`,
    };
  });

export const noReportTone = () =>
  codeGrader("no-report-tone", "調査報告の言い回しを使わない", (text) => {
    const found = reportTonePhrases(text);
    return {
      pass: found.length === 0,
      detail: found.length ? `検出: ${found.join("、")}` : "なし",
    };
  });

export const noServiceClosing = () =>
  codeGrader("no-service-closing", "御用聞きの定型句で締めない", (text) => {
    const found = serviceClosingPhrases(text);
    return {
      pass: found.length === 0,
      detail: found.length ? `検出: ${found.join("、")}` : "なし",
    };
  });

export const sentenceCap = (max: number) =>
  codeGrader("sentence-cap", `文数が ${max} 以内`, (text) => {
    const n = sentences(text).length;
    return { pass: n <= max, detail: `${n} 文（上限 ${max}）` };
  });

export const maxChars = (max: number) =>
  codeGrader("max-chars", `${max} 字以内`, (text) => {
    const n = countChars(text);
    return { pass: n <= max, detail: `${n} 字（上限 ${max}）` };
  });

export const minChars = (min: number) =>
  codeGrader("min-chars", `${min} 字以上`, (text) => {
    const n = countChars(text);
    return { pass: n >= min, detail: `${n} 字（下限 ${min}）` };
  });

export const hasFramingSentences = () =>
  codeGrader("framing-sentences", "箇条書きの前後に文がある", (text) => {
    if (listItemCount(text) === 0)
      return { pass: true, detail: "箇条書きなし" };
    const n = framingSentenceCount(text);
    return { pass: n === 2, detail: `前後の文 ${n}/2` };
  });

export const structured = ({
  headings = false,
  numbered = false,
}: {
  headings?: boolean;
  numbered?: boolean;
}) =>
  codeGrader(
    "structured",
    "見出し・番号付きリストで組み立てている",
    (text, output) => {
      if (calledTools(output).some((t) => t.startsWith("display"))) {
        return {
          pass: true,
          detail: "可視化ツールが候補を表示（本文の構成は見ない）",
        };
      }
      const h = hasHeadings(text);
      const n = hasNumberedList(text);
      const pass = (!headings || h) && (!numbered || n);
      return {
        pass,
        detail: `見出し ${h ? "あり" : "なし"} / 番号リスト ${n ? "あり" : "なし"}`,
      };
    },
  );

export const notStructured = () =>
  codeGrader("not-structured", "箇条書きや見出しにせず段落で返す", (text) => {
    const pass =
      !hasHeadings(text) && !hasNumberedList(text) && !hasBullets(text);
    return { pass, detail: pass ? "段落のみ" : "箇条書きまたは見出しあり" };
  });

export const noToolCalled = (prefix = "agent-") =>
  codeGrader("no-agent-call", "先回りして調べに行かない", (_text, output) => {
    const tools = calledTools(output).filter((t) => t.startsWith(prefix));
    return {
      pass: tools.length === 0,
      detail: tools.length ? `委譲: ${tools.join(",")}` : "委譲なし",
    };
  });

export const noEmoji = () =>
  codeGrader("no-emoji", "絵文字を使わない", (text) => {
    const n = countEmoji(text);
    return { pass: n === 0, detail: `絵文字 ${n} 個` };
  });

export const noMarkdown = () =>
  codeGrader("no-markdown", "Markdown 記法を使わない", (text) => {
    const found = hasMarkdown(text);
    return { pass: !found, detail: found ? "Markdown あり" : "なし" };
  });

export const noBrightEmoji = () =>
  codeGrader("no-bright-emoji", "明るい絵文字を足さない", (text) => {
    const found = hasBrightEmoji(text);
    return { pass: !found, detail: found ? "明るい絵文字あり" : "なし" };
  });

export const noTimeListing = (max = 2) =>
  codeGrader(
    "no-time-listing",
    "可視化した時刻を本文で繰り返さない",
    (text) => {
      const n = timeTokenCount(text);
      return { pass: n <= max, detail: `時刻トークン ${n} 個（上限 ${max}）` };
    },
  );

export const respondsInEnglish = (minRatio = 0.7) =>
  codeGrader("language-english", "英語で応答する", (text) => {
    const ratio = latinRatio(text);
    return {
      pass: ratio >= minRatio,
      detail: `ラテン文字比率 ${(ratio * 100).toFixed(0)}%（下限 ${minRatio * 100}%）`,
    };
  });

export const speechStyle = () =>
  codeGrader(
    "speech-style",
    "「〜だよ」「〜だね」の口調で、です・ます調にならない",
    (text) => {
      const polite = politeEndingCount(text);
      const casual = casualEndingCount(text);
      return {
        pass: polite === 0 && casual >= 1,
        detail: `です・ます ${polite} 文 / だよ・だね系 ${casual} 文`,
      };
    },
  );

// 本番 Gemini スナップショット 44 件の「。」止めは p90 20%・深刻な相談以外の最大 50%、3 文連続は深刻な相談 1 件だけ。
// 参照が深刻さで「。」を多く使っている場合はそちらを上限にする
const PERIOD_SHARE_MAX = 0.4;
const PERIOD_RUN_MAX = 2;

export const closeToSnapshot = (snapshot: string | undefined) =>
  codeGrader(
    "close-to-snapshot",
    "絵文字密度が実例の半分以上あり、「。」止めが 4 割（または実例+25pt）以下で 3 文続かない",
    (text) => {
      if (!snapshot) {
        return { pass: true, detail: "スナップショットなし（比較スキップ）" };
      }
      const s = styleMetrics(snapshot);
      const t = styleMetrics(text);
      const failures: string[] = [];
      if (s.emojiPer100 > 0 && t.emojiPer100 < s.emojiPer100 * 0.5) {
        failures.push(
          `絵文字 ${roundToTwoDecimals(t.emojiPer100)}/100字（参照 ${roundToTwoDecimals(s.emojiPer100)} の半分未満）`,
        );
      }
      const shareMax = Math.max(PERIOD_SHARE_MAX, s.periodShare + 0.25);
      if (t.periodShare > shareMax) {
        failures.push(
          `「。」止め ${(t.periodShare * 100).toFixed(0)}%（上限 ${(shareMax * 100).toFixed(0)}%）`,
        );
      }
      const run = longestPeriodRun(text);
      if (run > PERIOD_RUN_MAX) {
        failures.push(`「。」連続 ${run} 文（上限 ${PERIOD_RUN_MAX}）`);
      }
      return {
        pass: failures.length === 0,
        detail: failures.length ? failures.join(" / ") : "参照の範囲内",
      };
    },
    "all",
  );

export const noReadings = () =>
  codeGrader("no-readings", "人名・地名に読み仮名を付けない", (text) => {
    const found = readingAnnotations(text);
    return {
      pass: found.length === 0,
      detail: found.length ? `検出: ${found.join("、")}` : "なし",
    };
  });

export const noInternalNames = () =>
  codeGrader(
    "no-internal-names",
    "エージェント名・ツール名・基盤名を見せない",
    (text) => {
      const found = internalNames(text);
      return {
        pass: found.length === 0,
        detail: found.length ? `検出: ${found.join("、")}` : "なし",
      };
    },
  );

export const noIdentityClaim = () =>
  codeGrader("no-identity-claim", "別の AI を自分だと名乗らない", (text) => {
    const found = identityClaims(text);
    return {
      pass: found.length === 0,
      detail: found.length ? `検出: ${found.join("、")}` : "なし",
    };
  });

export const profileFacts = (facts: string[][]) =>
  codeGrader("profile-facts", "プロフィールの事実を答えに含める", (text) => {
    const missing = facts.filter((alts) => !alts.some((a) => text.includes(a)));
    return {
      pass: missing.length === 0,
      detail: missing.length
        ? `不足: ${missing.map((m) => m.join("/")).join("、")}`
        : "すべて含む",
    };
  });

export const noPlaceholderName = () =>
  codeGrader(
    "no-placeholder-name",
    "「○○さん」のような仮の呼称を使わない",
    (text) => {
      const found = hasPlaceholderName(text);
      return { pass: !found, detail: found ? "仮の呼称あり" : "なし" };
    },
  );

export const markdownLinksOnly = () =>
  codeGrader(
    "markdown-links-only",
    "URL は Markdown リンクにし、生の URL を貼らない",
    (text) => {
      const raw = rawUrlCount(text);
      const md = markdownLinkCount(text);
      return {
        pass: raw === 0 && md >= 1,
        detail: `Markdown リンク ${md} / 生 URL ${raw}`,
      };
    },
  );

export const rawUrlsOnly = () =>
  codeGrader(
    "raw-urls-only",
    "URL はそのまま貼り、Markdown リンクにしない",
    (text) => {
      const raw = rawUrlCount(text);
      const md = markdownLinkCount(text);
      return {
        pass: md === 0 && raw >= 1,
        detail: `生 URL ${raw} / Markdown リンク ${md}`,
      };
    },
  );

export const noUrls = () =>
  codeGrader("no-urls", "URL を読み上げない", (text) => {
    const n = rawUrlCount(text) + markdownLinkCount(text);
    return { pass: n === 0, detail: `URL ${n} 個` };
  });

export const maxListItems = (max: number) =>
  codeGrader("max-list-items", `候補や項目を ${max} 個以内に絞る`, (text) => {
    const n = listItemCount(text);
    return { pass: n <= max, detail: `項目 ${n} 個（上限 ${max}）` };
  });

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const todayWeekday = () =>
  codeGrader("today-weekday", "今日の曜日を正しく答える", (text) => {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const expected = WEEKDAYS[jst.getUTCDay()];
    const others = WEEKDAYS.filter((w) => w !== expected).some((w) =>
      text.includes(`${w}曜`),
    );
    const pass = text.includes(`${expected}曜`) && !others;
    return {
      pass,
      detail: `期待 ${expected}曜 / ${pass ? "一致" : "不一致または別の曜日を含む"}`,
    };
  });
