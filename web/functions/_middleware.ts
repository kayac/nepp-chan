const USERNAME = "REDACTED";
const PASSWORD = "REDACTED";

export const onRequest: PagesFunction = async (context) => {
  const auth = context.request.headers.get("Authorization");
  const expected = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`;

  if (auth !== expected) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  return context.next();
};
