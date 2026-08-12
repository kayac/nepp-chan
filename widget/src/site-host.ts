export const resolveSiteHost = (search: string) => {
  const host = new URLSearchParams(search).get("host");
  if (!host) return undefined;
  try {
    return new URL(host).hostname;
  } catch {
    return undefined;
  }
};
