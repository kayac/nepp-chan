import { HTTPException } from "hono/http-exception";

/**
 * middleware 経由でセットされている前提の Context 変数を取り出す。
 * undefined / null なら middleware 構成ミスとして 500 を投げる。
 */
export const ensureContextValue = <T>(
  value: T | undefined | null,
  key: string,
): T => {
  if (value == null) {
    throw new HTTPException(500, {
      message: `Required context variable "${key}" is not set (middleware misconfiguration)`,
    });
  }
  return value;
};
