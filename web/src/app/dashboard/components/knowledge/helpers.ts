import { CONVERTIBLE_MIME_TYPES } from "@nepp-chan/shared/constants/knowledge";
import type { CuratedDraftRequest } from "~/types";

export const CURATED_PREFIX = "curated/";
export const DRAFT_FILE_ACCEPT = CONVERTIBLE_MIME_TYPES.join(",");
export const INPUT_CLASS =
  "w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-stone-100";

const URL_PATTERN = /https?:\/\/[^\s<>"'）)]+/g;

export type SourceKind = "url" | "text" | "files";

export type DraftFormFields = {
  kind: SourceKind;
  urls: string[];
  text: string;
  files: File[];
};

export const isCuratedKey = (key: string) => key.startsWith(CURATED_PREFIX);

export const slugFromKey = (key: string) =>
  (key.startsWith(CURATED_PREFIX)
    ? key.slice(CURATED_PREFIX.length)
    : key
  ).replace(/\.md$/, "");

export const keyFromSlug = (slug: string) =>
  `${CURATED_PREFIX}${slug.trim()}.md`;

export const isValidSlug = (slug: string) => /^[^/]+$/.test(slug.trim());

export const extractUrls = (text: string) => [
  ...new Set(text.match(URL_PATTERN) ?? []),
];

export const addUrls = (current: string[], input: string, max: number) => {
  const found = extractUrls(input);
  const merged = [...new Set([...current, ...found])].slice(0, max);
  return { urls: merged, accepted: found.length > 0 };
};

export const toDraftRequest = (
  fields: DraftFormFields,
): CuratedDraftRequest => {
  switch (fields.kind) {
    case "url":
      return {
        urls: [...new Set(fields.urls.map((u) => u.trim()).filter(Boolean))],
        files: [],
      };
    case "text":
      return {
        urls: extractUrls(fields.text),
        text: fields.text.trim() || undefined,
        files: [],
      };
    case "files":
      return { urls: [], files: fields.files };
  }
};

export const hasDraftInput = (fields: DraftFormFields) => {
  const request = toDraftRequest(fields);
  return request.urls.length > 0 || !!request.text || request.files.length > 0;
};

export type DraftParts = { frontmatter: string; title: string; body: string };

const yamlQuote = (value: string) =>
  /[:#'"\n]|^[\s\-?[\]{}&*!|>%@`]|\s$/.test(value)
    ? `'${value.replace(/'/g, "''")}'`
    : value;

export const splitDraft = (content: string): DraftParts => {
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  const frontmatter = fmMatch?.[0] ?? "";
  const rest = content.slice(frontmatter.length);
  const h1Match = rest.match(/^\s*# (.+)\n?/);
  const fmTitle = frontmatter.match(/^title: (.*)$/m)?.[1]?.trim();
  const title =
    h1Match?.[1]?.trim() ?? fmTitle?.replace(/^'(.*)'$/, "$1") ?? "";
  const body = (h1Match ? rest.slice(h1Match[0].length) : rest).replace(
    /^\n+/,
    "",
  );
  return { frontmatter, title, body };
};

export const joinDraft = ({ frontmatter, title, body }: DraftParts) => {
  const fm = /^title: .*$/m.test(frontmatter)
    ? frontmatter.replace(/^title: .*$/m, `title: ${yamlQuote(title)}`)
    : frontmatter;
  const heading = title.trim() ? `# ${title.trim()}\n\n` : "";
  return `${fm}${heading}${body}`;
};

export const hostLabel = (url: string) => {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname === "/" ? "" : pathname;
    return `${hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
};
