export type ChoiceFormState = { id: string; value: string };

/**
 * 入力された choices から空白を除いた有効な選択肢配列を返す。
 */
export const collectValidChoices = (
  choices: readonly ChoiceFormState[],
): string[] => choices.map((c) => c.value.trim()).filter((v) => v.length > 0);

/**
 * 投票作成 form の必須要件:
 * - title が空白のみではない
 * - 有効選択肢が 2 件以上
 */
export const isPollFormValid = (
  title: string,
  validChoices: readonly string[],
): boolean => !!title.trim() && validChoices.length >= 2;
