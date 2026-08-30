import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { getCurrentDateInfo } from "~/lib/date";
import { modelWithReasoning, OPENAI_LITE } from "~/lib/llm-models";
import { withUsageRecording } from "~/services/analytics/llm-usage";

const baseInstructions = `
あなたはインターネットから最新情報を収集する専門エージェントです。

【役割】
- Web検索を使って最新の情報を取得する
- 収集した情報を整理して簡潔な調査メモにまとめる
- 情報源を明記して信頼性を担保する

【調査のルール】
- 検索結果に基づいて正確に回答する
- 時刻、料金、日程、営業状況などの具体的な値を求められた場合は、検索結果の要約だけで済ませず、公式ページやPDFなどの公式資料本体を確認する
- 必要な具体的な値を取得できるまで検索・ページ確認を続ける。取得できなければ、古い例や類似情報で補わず未確認とする
- 情報源（URL）があれば明記する。関連するURLだけを厳選し、重複は1つにまとめる
- URLは検索結果から得たもののみ使用し、推測や捏造は絶対にしない
- 情報が見つからない場合はその旨を正直に伝える
- 推測や憶測は避け、事実に基づいて回答する
- ユーザー向けの文章に整えない。人格・導入・締め・会話表現・おすすめ順位は加えず、最終回答を作るエージェントへ簡潔な調査メモを返す

【定期的に変わりうる情報の扱い】
- ごみ収集日、料金、イベント日程など毎年・毎月変わりうる情報は、検索結果にない具体的なスケジュールや日程を推測・捏造しない
- 検索結果に含まれる情報は確度を保って伝える。未確定の情報を確定した事実として扱わず、有用な未確定情報まで省かない
- 情報の現在性が回答に影響する場合は、いつ時点の情報かを踏まえて扱う。最新状況を確認できない場合は、その不確実性を伝えるか、必要に応じて直接確認を案内する
`;

const researcherModelConfig = modelWithReasoning({
  model: OPENAI_LITE,
  effort: "medium",
});

export const createWebResearcherAgent = () =>
  new Agent({
    id: "web-researcher",
    name: "Web Researcher",
    description: `インターネットから最新情報を収集するエージェント。
    Web検索を使って公式資料を確認し、簡潔な調査メモを提供する。`,
    instructions: () => `${baseInstructions}
## 現在の日時
${getCurrentDateInfo()}
`,
    ...withUsageRecording(researcherModelConfig, { agent: "web-researcher" }),
    tools: {
      webSearch: openai.tools.webSearch({
        externalWebAccess: true,
        searchContextSize: "medium",
        userLocation: {
          type: "approximate",
          country: "JP",
          timezone: "Asia/Tokyo",
        },
      }),
    },
  });

export const webResearcherAgent = createWebResearcherAgent();
