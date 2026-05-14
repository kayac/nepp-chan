import { expect } from "vitest";

/**
 * null / undefined のいずれも弾き、以降のコードで NonNullable<T> として narrow させる。
 * Drizzle の戻り値（undefined）と DB nullable 列（null）の双方を一度に保証するために両方チェックする。
 */
export function assertDefined<T>(value: T): asserts value is NonNullable<T> {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}
