export const normalizeSiteHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
