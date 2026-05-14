/**
 * mastra/tools の execute(inputData, context) で使う context のテスト用 builder。
 * RuntimeContext.get(key) の値だけ差し替えれば十分なので、最低限のスタブを返す。
 */
// biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
export const buildToolContext = (values: Record<string, unknown>): any => ({
  requestContext: {
    get: (key: string) => values[key],
  },
});

/**
 * tool.execute の戻り値は ValidationError との union になりプロパティが絞れないため、
 * テスト側で実装の戻り値を直接検証するための薄いラッパー。
 */
export const callTool = async (
  // biome-ignore lint/suspicious/noExplicitAny: createTool のシグネチャに依存しないラッパー
  tool: { execute?: (input: any, ctx: any) => Promise<unknown> },
  input: unknown,
  values: Record<string, unknown> = {},
  // biome-ignore lint/suspicious/noExplicitAny: 上記理由
): Promise<any> => {
  if (!tool.execute) throw new Error("tool has no execute");
  return await tool.execute(input, buildToolContext(values));
};
