interface Env {
  BASIC_AUTH_USER: string;
  BASIC_AUTH_PASSWORD: string;
}

const PUBLIC_PATHS = ["/dashboard/login", "/dashboard/register"];

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (PUBLIC_PATHS.some((path) => url.pathname.startsWith(path))) {
    return context.next();
  }

  const { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = context.env;

  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    return context.next();
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
