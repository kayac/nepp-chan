import * as Sentry from "@sentry/cloudflare";

const PRIVACY_CRITICAL_TAG = "privacy_critical";
const PRIVACY_CRITICAL_LEVEL = "fatal" as const;

/**
 * 個人情報保護クリティカル処理（削除パイプライン等）の失敗を Sentry に重大通知として送信する。
 * Queue リトライなどで例外を再 throw しない経路で使う（withSentry の自動 capture が走らない箇所）。
 */
export const reportPrivacyCriticalError = (
  error: unknown,
  component: string,
) => {
  Sentry.captureException(error, {
    level: PRIVACY_CRITICAL_LEVEL,
    tags: { [PRIVACY_CRITICAL_TAG]: "true", component },
  });
};

/**
 * scheduled handler や fetch handler 等、withSentry が例外を自動 capture する経路で
 * 現在の scope に重大通知タグを設定する。catch 内で呼んでから throw すると、
 * withSentry が capture する際に level / tags が反映される。
 */
export const markPrivacyCriticalScope = (component: string) => {
  const scope = Sentry.getCurrentScope();
  scope.setLevel(PRIVACY_CRITICAL_LEVEL);
  scope.setTag(PRIVACY_CRITICAL_TAG, "true");
  scope.setTag("component", component);
};
