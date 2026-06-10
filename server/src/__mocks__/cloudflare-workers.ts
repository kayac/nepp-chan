// vitest 用の cloudflare:workers モック（モジュールは workerd 上にしか存在しない）
export const waitUntil = (_promise: Promise<unknown>) => {};
