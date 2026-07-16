// vitest 用の cloudflare:workers モック（モジュールは workerd 上にしか存在しない）
export const waitUntil = (_promise: Promise<unknown>) => {};

export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
