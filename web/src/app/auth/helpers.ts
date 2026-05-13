export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export const validatePassword = (
  password: string,
  confirmPassword: string,
): PasswordValidationResult => {
  if (password !== confirmPassword) {
    return { ok: false, message: "パスワードが一致しません" };
  }
  if (password.length < 8) {
    return { ok: false, message: "パスワードは8文字以上で入力してください" };
  }
  return { ok: true };
};
