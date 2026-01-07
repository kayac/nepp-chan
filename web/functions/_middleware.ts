interface Env {
  BASIC_AUTH_USER: string;
  BASIC_AUTH_PASSWORD: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = context.env;

  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    return new Response("Basic auth not configured", { status: 500 });
  }

  const auth = context.request.headers.get("Authorization");
  const expected = `Basic ${btoa(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`)}`;

  if (auth !== expected) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  return context.next();
};
