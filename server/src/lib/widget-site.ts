// 保存も照合もこの形に揃える（widget から来る host は表記ゆれがあり、完全一致で引くため）
export const normalizeSiteHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
