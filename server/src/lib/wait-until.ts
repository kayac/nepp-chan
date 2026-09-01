// cloudflare:workers は workerd 専用モジュール。top-level import すると
// このファイルを import 経由で読む Node 実行の eval スクリプトが落ちる
export const waitUntilInBackground = (promise: Promise<unknown>) => {
  void import("cloudflare:workers")
    .then(({ waitUntil }) => waitUntil(promise))
    .catch(() => {});
};
