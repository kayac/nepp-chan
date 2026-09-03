import { htmlToText } from "~/lib/html-to-text";

const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

export const isXPostUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      X_HOSTS.has(parsed.hostname) &&
      /^\/[^/]+\/status\/\d+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

type OEmbedResponse = {
  html: string;
  author_name: string;
};

export const fetchXPostText = async (url: string, timeoutMs = 15_000) => {
  const endpoint = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&lang=ja`;
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`投稿を取得できませんでした（HTTP ${response.status}）`);
  }
  const data = (await response.json()) as OEmbedResponse;
  return { text: htmlToText(data.html), authorName: data.author_name };
};
