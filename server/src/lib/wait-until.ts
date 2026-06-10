/**
 * Response 返却後も Promise の完了を Workers ランタイムに保証させる。
 * executionCtx を持たない環境（vitest の app.request）ではアクセス自体が
 * throw するため、その場合はバックグラウンド実行に任せる。
 */
export const waitUntilSafe = (
  c: { executionCtx: { waitUntil: (promise: Promise<unknown>) => void } },
  promise: Promise<unknown>,
) => {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    // executionCtx が無い環境では何もしない
  }
};
