const CHARSET_SNIFF_BYTES = 4096;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
};

export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

const charsetFrom = (text: string | null) =>
  text?.match(/charset=["']?([\w-]+)/i)?.[1];

export const detectCharset = (headHtml: string, contentType: string | null) =>
  charsetFrom(contentType) ?? charsetFrom(headHtml) ?? "utf-8";

export const decodeHtml = (buffer: ArrayBuffer, contentType: string | null) => {
  const head = new TextDecoder("latin1").decode(
    buffer.slice(0, CHARSET_SNIFF_BYTES),
  );
  const charset = detectCharset(head, contentType);
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder().decode(buffer);
  }
};

const BLOCK_END_TAGS =
  /<\/(?:p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|dd|dt|pre|table)>|<br\s*\/?>|<hr\s*\/?>/gi;

export const htmlToText = (html: string) => {
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(BLOCK_END_TAGS, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const metaContent = (html: string, key: string) => {
  const attr = `(?:property|name)=["']${key}["']`;
  const before = html.match(
    new RegExp(`<meta[^>]*${attr}[^>]*content=["']([^"']*)["']`, "i"),
  );
  const after = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}`, "i"),
  );
  const raw = before?.[1] ?? after?.[1];
  return raw ? decodeEntities(raw).trim() || undefined : undefined;
};

export const extractPageText = (html: string) => {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    metaContent(html, "og:title") ??
    (titleTag ? decodeEntities(titleTag).trim() || undefined : undefined);
  const description =
    metaContent(html, "og:description") ?? metaContent(html, "description");

  const body = html.replace(/<head\b[\s\S]*?<\/head>/i, "");
  return { title, description, text: htmlToText(body) };
};
