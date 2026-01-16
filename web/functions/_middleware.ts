interface Env {
  BASIC_AUTH_USER: string;
  BASIC_AUTH_PASSWORD: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
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
