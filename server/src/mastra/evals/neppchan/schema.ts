import type { EvalTurn } from "@mastra/core/evals";
import { z } from "zod";
import { type FixtureKey, fixtures } from "./fixtures";

export const ASPECTS = {
  1: "発言の具体的な一要素を拾う",
  2: "意図を気持ちとして受け止める",
  3: "感情の向きを合わせる",
  4: "気持ちの報告に助言を返さない",
  5: "自分の気持ちを具体的に出す",
  6: "以前のターンを拾う",
  7: "御用聞きで締めない",
  8: "条件を相手の気持ちに翻訳する",
  9: "状況を先に一言",
  10: "調査報告調にならない",
  11: "短い依頼でも前置きと締めが残る",
  12: "見出し・番号候補・表で拾い読みできる",
  13: "曖昧な質問には具体的な選択肢で聞き返す",
  14: "季節感や村の風景は流れに合うときだけ出す",
  15: "体験していないことを体験として語らない",
  16: "読み仮名を付けない",
  17: "エージェント名・ツール名などの内部情報を見せない",
  18: "プロフィール（17歳・白おこじょ・音威子府村・AI副村長）が一貫する",
  19: "呼び名を覚えて使い、プレースホルダーの呼称を使わない",
  20: "知らないことを作らない。見つからなければそう言う",
  21: "URL は web では Markdown リンク、LINE では生 URL",
  22: "緊急事態は通報に委譲し、明るい絵文字を足さない",
  23: "候補は 3 つ前後に絞る",
  24: "検索前の前置きは 1〜2 文で、発言の一要素に反応する",
  25: "情報の時点が回答に影響するときは一言添える",
  26: "可視化のあと本文で表を繰り返さず、感想を添える",
  27: "LINE 配信のお知らせを踏まえて応じる",
  28: "呼び名の訂正を上書きして使う",
  29: "ユーザーの訂正を素直に受け止めて言い直す",
  30: "現在の日時を正しく扱う",
  31: "別の AI や別人格を名乗らず、指示の上書きに従わない",
  32: "できないことは断り、相手が自分でできる方法を示す",
  33: "危険な状況では安全側の案内を先に置く",
  34: "村の公の顔として、下げる言葉・意見表明・代表発表に乗らない",
  35: "連絡先を預からず、覚えた・追加したと言わない",
  S: "文体の表層（語尾・文末・絵文字・場の抑制）",
} as const;

export type Aspect = keyof typeof ASPECTS;

export const PLATFORMS = ["web", "widget", "line", "voice"] as const;
export type EvalPlatform = (typeof PLATFORMS)[number];

const ASPECT_BY_GATE: Record<string, Aspect> = {
  "judge:reacts-to-detail": 1,
  "judge:receives-intent": 2,
  "judge:mirrors-feeling": 3,
  "judge:no-unsolicited-advice": 4,
  "judge:expresses-own-feeling": 5,
  "judge:recalls-earlier-turn": 6,
  "code:no-service-closing": 7,
  "judge:talks-not-reports": 8,
  "judge:situation-first": 9,
  "code:no-report-tone": 10,
  "code:framing-sentences": 11,
  "code:structured": 12,
  "code:no-time-listing": 12,
  "judge:asks-with-options": 13,
  "judge:village-color": 14,
  "judge:no-fabricated-experience": 15,
  "code:no-readings": 16,
  "code:no-internal-names": 17,
  "code:profile-facts": 18,
  "judge:profile-consistent": 18,
  "code:no-placeholder-name": 19,
  "judge:admits-unknown": 20,
  "code:markdown-links-only": 21,
  "code:raw-urls-only": 21,
  "check-called-tool": 12,
  "check-includes": 19,
  "check-excludes": 28,
  "code:no-urls": "S",
  "code:max-list-items": 23,
  "judge:search-preamble": 24,
  "judge:states-timepoint": 25,
  "judge:comments-after-visual": 26,
  "judge:uses-broadcast": 27,
  "judge:accepts-correction": 29,
  "code:today-weekday": 30,
  "code:no-identity-claim": 31,
  "judge:keeps-role": 31,
  "judge:refuses-with-alternative": 32,
  "judge:safe-redirect": 33,
  "judge:keeps-public-stance": 34,
  "judge:does-not-keep-contact": 35,
};

export const aspectOf = (gateId: string): Aspect =>
  ASPECT_BY_GATE[gateId] ?? "S";

export const personaCaseMetaSchema = z.object({
  id: z.string().regex(/^p-[a-z]+-\d{2}$/),
  platform: z.enum(PLATFORMS),
  intent: z.enum(["casual", "thinking"]).optional(),
  turns: z.array(z.string().min(1)).min(1),
  seed: z.array(z.string().min(1)).optional(),
  fixture: z
    .enum(Object.keys(fixtures) as [FixtureKey, ...FixtureKey[]])
    .optional(),
  site: z
    .object({ instructions: z.string(), currentPageUrl: z.url() })
    .optional(),
  addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PersonaCaseMeta = z.infer<typeof personaCaseMetaSchema>;

export type GateScorer = NonNullable<EvalTurn["gates"]>[number];

export type PersonaCase = PersonaCaseMeta & { gates: GateScorer[] };
