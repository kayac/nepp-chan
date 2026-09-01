export const normalizeUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
};

export const hostOf = (value: string) => {
  try {
    return new URL(value.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};
