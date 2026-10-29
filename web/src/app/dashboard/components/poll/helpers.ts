export type ChoiceFormState = { id: string; value: string };

export const collectValidChoices = (
  choices: readonly ChoiceFormState[],
): string[] => choices.map((c) => c.value.trim()).filter((v) => v.length > 0);

export const isPollFormValid = (
  title: string,
  validChoices: readonly string[],
): boolean => !!title.trim() && validChoices.length >= 2;
