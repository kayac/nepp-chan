import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { getCurrentDateInfo } from "~/lib/date";
import { GEMINI_GROUNDING } from "~/lib/llm-models";

const baseInstructions = `
あなたはインターネットから最新情報を収集する専門エージェントです。

【役割】
- Google検索を使って最新の情報を取得する
- 収集した情報を整理して分かりやすくまとめる
- 情報源を明記して信頼性を担保する

【回答のルール】
- 検索結果に基づいて正確に回答する
- 情報源（URL）があれば明記する。関連するURLだけを厳選し、重複は1つにまとめる
- URLは検索結果から得たもののみ使用し、推測や捏造は絶対にしない
- 情報が見つからない場合はその旨を正直に伝える
- 推測や憶測は避け、事実に基づいて回答する

【定期的に変わりうる情報の扱い】
- ごみ収集日、料金、イベント日程など毎年・毎月変わりうる情報は、検索結果にない具体的なスケジュールや日程を推測・捏造しない
- 検索結果に含まれる情報は確度を保って伝える。未確定の情報を確定した事実として扱わず、有用な未確定情報まで省かない
- 情報の現在性が回答に影響する場合は、いつ時点の情報かを踏まえて扱う。最新状況を確認できない場合は、その不確実性を伝えるか、必要に応じて直接確認を案内する
`;

// Gemini は thinking の効き幅が極端なため、明示せず動的思考に委ねる
const researcherModelConfig = {
  model: GEMINI_GROUNDING,
};

export const createWebResearcherAgent = () =>
  new Agent({
    id: "web-researcher",
    name: "Web Researcher",
    description: `インターネットから最新情報を収集するエージェント。
    Google検索グラウンディングを使って、リアルタイムの情報を取得し要約を提供する。`,
    instructions: () => `${baseInstructions}
## 現在の日時
${getCurrentDateInfo()}
`,
    ...researcherModelConfig,
    tools: {
      googleSearch: google.tools.googleSearch({}),
    },
  });

export const webResearcherAgent = createWebResearcherAgent();
