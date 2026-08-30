export const splitSearchKeywords = (query: string, limit = 5) =>
  query
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, limit);
