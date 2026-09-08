import {
  CONVERTIBLE_MIME_TYPES,
  CURATED_PREFIX,
  OFFICIAL_PREFIX,
} from "@nepp-chan/shared/constants/knowledge";
import type { CuratedDraftRequest, FileInfo } from "~/types";

export type { KnowledgePrefix } from "@nepp-chan/shared/constants/knowledge";
export { CURATED_PREFIX, OFFICIAL_PREFIX };
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
export const isOfficialKey = (key: string) => key.startsWith(OFFICIAL_PREFIX);

export const isCuratedFile = (file: FileInfo) => isCuratedKey(file.key);
export const isOfficialFile = (file: FileInfo) => isOfficialKey(file.key);

export const canDeleteFile = (file: FileInfo) =>
  isCuratedFile(file) || isOfficialFile(file);

export const splitKey = (key: string) => {
  const index = key.lastIndexOf("/") + 1;
  return { dir: key.slice(0, index), name: key.slice(index) };
};

export const toRelativePath = (path: string) => path.replace(/^\/+/, "");

export const isUploadableMarkdown = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.endsWith(".md") && !name.startsWith(".");
};

export type UploadCandidate = { file: File; relativePath: string };

export const stripTopFolder = (path: string) =>
  path.slice(path.indexOf("/") + 1);

export const pickedFilesToCandidates = (files: Iterable<File>) =>
  Array.from(files)
    .map((file) => ({
      file,
      relativePath: file.webkitRelativePath
        ? stripTopFolder(toRelativePath(file.webkitRelativePath))
        : file.name,
    }))
    .filter((candidate) => isUploadableMarkdown(candidate.relativePath));

export type EntryReader = Pick<FileSystemDirectoryReader, "readEntries">;

export const readAllEntries = async (reader: EntryReader) => {
  const all: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
};

export type EntryDeps = {
  readDirectory: (dir: FileSystemDirectoryEntry) => Promise<FileSystemEntry[]>;
  readFile: (entry: FileSystemFileEntry) => Promise<File>;
};

const walkEntries = async (
  entries: FileSystemEntry[],
  root: string,
  deps: EntryDeps,
): Promise<UploadCandidate[]> => {
  const collected: UploadCandidate[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const children = await deps.readDirectory(
        entry as FileSystemDirectoryEntry,
      );
      collected.push(...(await walkEntries(children, root, deps)));
    } else if (entry.isFile) {
      const relativePath = toRelativePath(entry.fullPath.slice(root.length));
      if (!isUploadableMarkdown(relativePath)) continue;
      collected.push({
        file: await deps.readFile(entry as FileSystemFileEntry),
        relativePath,
      });
    }
  }
  return collected;
};

export const collectMarkdownFiles = async (
  entries: FileSystemEntry[],
  deps: EntryDeps,
) => {
  const collected: UploadCandidate[] = [];
  for (const entry of entries) {
    const root = entry.isDirectory ? entry.fullPath : "";
    collected.push(...(await walkEntries([entry], root, deps)));
  }
  return collected;
};

export const runWithConcurrency = async <T>(
  tasks: (() => Promise<T>)[],
  limit: number,
) => {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
};

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
