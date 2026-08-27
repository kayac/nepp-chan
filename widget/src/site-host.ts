const resolveSiteUrl = (search: string) => {
  const host = new URLSearchParams(search).get("host");
  if (!host) return undefined;
  try {
    return new URL(host);
  } catch {
    return undefined;
  }
};

export const resolveSiteHost = (search: string) =>
  resolveSiteUrl(search)?.hostname;

export const resolveSitePageUrl = (search: string) =>
  resolveSiteUrl(search)?.href;
