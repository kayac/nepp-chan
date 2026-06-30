interface Env {
  BASIC_AUTH_USER: string;
  BASIC_AUTH_PASSWORD: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // 埋め込みウィジェット本体と、それが参照する公開アセット（マスコット画像）は
  // 外部サイトから読み込まれるため Basic 認証の対象外
  const { pathname } = new URL(context.request.url);
  if (pathname.startsWith("/widget/") || pathname.startsWith("/mascot/")) {
    return context.next();
  }

  const { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = context.env;

  // Basic 認証
  if (BASIC_AUTH_USER && BASIC_AUTH_PASSWORD) {
    const auth = context.request.headers.get("Authorization");
    const expected = `Basic ${btoa(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`)}`;

    if (auth !== expected) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
      });
    }
  }

  return context.next();
};
