import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
} from "@mastra/core/evals";

interface KnowledgeSearchResult {
  content: string;
  score: number;
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
}

interface ToolInvocation {
  toolName: string;
  state: string;
  result?: {
    results?: KnowledgeSearchResult[];
  };
}

interface MessageWithToolInvocations {
  toolInvocations?: ToolInvocation[];
}

/**
 * knowledge-search ツールの実行結果からコンテキストを抽出する
 * ContextPrecisionScorer, ContextRelevanceScorer で使用
 */
export const extractKnowledgeContext = (
  _input: ScorerRunInputForAgent | undefined,
  output: ScorerRunOutputForAgent | undefined,
): string[] => {
  if (!output) return [];
  const contexts: string[] = [];

  for (const message of output) {
    const toolInvocations = (message as MessageWithToolInvocations)
      .toolInvocations;

    if (!toolInvocations) continue;

    for (const invocation of toolInvocations) {
      if (
        invocation.toolName === "knowledge-search" &&
        invocation.state === "result" &&
        invocation.result?.results
      ) {
        contexts.push(...invocation.result.results.map((r) => r.content));
      }
    }
  }

  return contexts;
};
