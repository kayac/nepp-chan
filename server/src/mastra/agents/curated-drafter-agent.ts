import { Agent } from "@mastra/core/agent";
import { modelWithReasoning } from "~/lib/llm-models";

const INSTRUCTIONS = `渡された資料から、地域案内 AI のナレッジになる 1 件分の下書きを日本語で作る。

- 資料に書いてあることだけを書く。自分の知識で補わない。資料が 1〜2 文しかなければ下書きも 1〜2 文にとどめる
- 無い項目は書かない。分からないことを「不明」とも書かない
- 複数の資料は 1 つの対象についての情報として統合する
- 営業時間・料金・日程など変わりうる情報は summary に書かず、notice の 1 文で公式サイトや SNS での確認を促す
- sourceLinks には資料中に現れた URL だけを入れる
- slug は対象を表す英小文字とハイフンだけの短い識別子にする（例: otoineppu-tokyo）`;

export const curatedDrafterAgent = new Agent({
  id: "curated-drafter",
  name: "Curated Drafter",
  instructions: INSTRUCTIONS,
  ...modelWithReasoning({ effort: "low" }),
});
