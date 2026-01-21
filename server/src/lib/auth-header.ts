/**
 * Authorization ヘッダーから Bearer トークンを抽出するユーティリティ
 */

type RequestLike = {
  req: { header: (name: string) => string | undefined };
};

export const getTokenFromHeader = (c: RequestLike) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
};
