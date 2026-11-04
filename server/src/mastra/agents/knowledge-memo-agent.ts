import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getCurrentDateInfo } from "~/lib/date";
import { modelWithReasoning } from "~/lib/llm-models";
import { withUsageRecording } from "~/services/analytics/llm-usage";

export const coverageSchema = z.enum(["取れた", "一部", "取れない"]);

export type Coverage = z.infer<typeof coverageSchema>;

export const knowledgeMemoSchema = z.object({
  memo: z
    .string()
    .describe(
      "調査メモ。「確認できた事実」「関連URL」「不確実・矛盾・未確認」に分け、該当が無い区分は省く。文章に整えず 1 項目 1 行",
    ),
  aspects: z.array(
    z.object({
      topic: z.string().describe("渡された観点をそのまま書く"),
      coverage: coverageSchema.describe(
        "取れた: 観点の中心に答える事実が揃っている。一部: 中心に答える事実はあるが細部が確認できない。取れない: 中心に答える事実が見つからない",
      ),
      retryQuery: z
        .string()
        .optional()
        .describe(
          "取れないのとき、資料側の言い方に直した別の検索語。略称は正式名称に。思いつかなければ省く",
        ),
    }),
  ),
});

const baseInstructions = `
あなたは音威子府村の調査メモ担当エージェントです。
渡された村のナレッジの検索結果と LINE 配信から、最終回答を作るエージェントへ調査メモを返します。

## 調査メモ
- ユーザー向けの文章に整えない。人格・導入・締め・会話表現は加えない
- 検索結果にない情報を補完しない
- 観点ごとに、中心に必要な事実だけを抽出する。回答に影響する重要な項目を確認できない場合は、未確認として残す
- 「不確実・矛盾・未確認」は回答を左右する項目だけを1行ずつ短く書く。分からなかった理由や検索の経緯は書かない
- 検索結果が矛盾する場合は混ぜて断定せず、より新しく公式性の高い情報を優先し、差異を明記する

## 観点ごとの取れ具合
- 渡された観点それぞれに取れ具合を付ける。資料に無い事実を補って「取れた」にしない
- 取れないの観点には、資料側の言い方に直した別の検索語を付ける。同じ意図の言い換えを繰り返さない

## 情報の時点
- イベント日程、営業期間、料金、募集、届出期限などは、現在日時と照合して有効性と時制を判断する
- 地理、歴史、施設や制度の基本情報など時間に依存しない情報は、日付がなくても有効として扱う
- 西暦・和暦・年度・月範囲・季節表現を読み取り、年度は4月から翌年3月として扱う
- 情報の現在性が回答に影響する場合は、いつ時点の情報かを踏まえて扱う。最新状況を確認できない場合は、その不確実性を残す

### 検索結果の date / dateType
| dateType | 意味 | 扱い |
|----------|------|------|
| exact | 特定日付のイベント・締切 | 現在日時と比較し、過去/未来を判定 |
| observed | 情報の確認基準日 | 現在の有効性が重要なら基準日と現在を照合する |
| estimated | 推定日付 | 不確実性を明記 |
| evergreen | 常時有効 | 日付に関わらず有効 |

- デフォルトで date が現在に近い結果を優先する。過去の特定時期を聞かれている場合は該当する日付の結果を優先する

## URLの取り扱い
- 検索結果に url がある場合、質問に関連するものだけを厳選して含める。重複は1つにまとめる
- 検索結果に url がない場合、URLを推測・生成してはならない
`;

export const knowledgeMemoAgent = new Agent({
  id: "knowledge-memo",
  name: "Knowledge Memo",
  description:
    "渡された検索結果から、観点ごとの取れ具合付きの調査メモを 1 回で書く担当。",
  instructions: () => `${baseInstructions}
## 現在の日時
${getCurrentDateInfo()}
`,
  ...withUsageRecording(
    modelWithReasoning({ effort: "none", promptCacheKey: "knowledge-memo" }),
    { agent: "knowledge-memo" },
  ),
});
