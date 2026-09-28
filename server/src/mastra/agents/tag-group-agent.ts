import { Agent } from "@mastra/core/agent";
import { modelWithReasoning } from "~/lib/llm-models";
import { withUsageRecording } from "~/services/analytics/llm-usage";

export const tagGroupAgent = new Agent({
  id: "tag-group-agent",
  name: "Tag Group Agent",
  description: "ペルソナの自由タグを既存のタググループに振り分ける",
  instructions: `村の声（ペルソナ）に付いた自由記述のタグを、既存のグループに振り分ける。
- attribute のグループは話者自身の属性（誰が話しているか）。話題を表すタグを入れない
- topic のグループは話題。話者の属性を表すタグを入れない
- exclude のグループには、分類名の写し・地名・意味の無い語のような、集計に使えないタグを入れる
- 意味が一致するグループが無い、または判断に迷うタグは groupId を null にする
- 入力に無いタグを作らない。groupId は与えられた一覧の id だけを使う`,
  ...withUsageRecording(
    modelWithReasoning({ effort: "low", promptCacheKey: "tag-group" }),
    { agent: "tag-group", source: "tag-group-assign" },
  ),
});
