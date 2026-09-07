import matter from "gray-matter";
import { z } from "zod";
import { JST_OFFSET_MS, jstDateLabel } from "~/lib/date";
import { decodeHtml, extractPageText } from "~/lib/html-to-text";
import { convertToMarkdown, isSupportedMimeType } from "~/lib/image-converter";
import { OPENAI_LITE } from "~/lib/llm-models";
import { fetchXPostText, isXPostUrl } from "~/lib/x-post";
import { curatedDrafterAgent } from "~/mastra/agents/curated-drafter-agent";
import { recordLlmUsage } from "~/services/analytics/llm-usage";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_CHARS = 30_000;
const MAX_PROMPT_CHARS = 60_000;
const HTML_MIME_TYPES = new Set(["text/html", "application/xhtml+xml"]);

export const NO_CONTENT_MESSAGE =
  "どの資料からも本文を取得できませんでした。Instagram / X のプロフィールページやログインが必要なページは読み取れないことがあります。個別投稿の URL、本文のコピー、スクリーンショット、検索キーワードから作成してください";

export class CuratedDraftError extends Error {
  constructor(readonly unreadable: Unreadable[]) {
    super(NO_CONTENT_MESSAGE);
    this.name = "CuratedDraftError";
  }
}

export type CuratedDraftInput = {
  urls: string[];
  text?: string;
  files: File[];
};

type Deps = {
  d1?: D1Database;
};

type SourceDocument = { label: string; text: string; url?: string };
export type Unreadable = { name: string; reason: string };

const CuratedDraftSchema = z.object({
  title: z.string().describe("対象の名称と短い補足"),
  category: z.string().describe("分類。店なら「お店・スポット」など"),
  slug: z.string().describe("英小文字とハイフンだけの識別子"),
  notice: z.string().describe("冒頭に置く注意書き 1 文"),
  summary: z.string().describe("本文。段落は空行で区切る"),
  sourceLinks: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .describe("資料中に現れた情報源 URL"),
});

export type CuratedDraftFields = z.infer<typeof CuratedDraftSchema>;

const stripWww = (host: string) => host.toLowerCase().replace(/^www\./, "");

export const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${stripWww(parsed.hostname)}${path}${parsed.search}`;
  } catch {
    return url;
  }
};

const isHttpUrl = (url: string) => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const isLoginPage = (final: URL) =>
  /\/(login|signin|accounts)(\/|$)/i.test(final.pathname);

const toReason = (error: unknown) => {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return `応答がありませんでした（${FETCH_TIMEOUT_MS / 1000} 秒）`;
    }
    return error.message;
  }
  return "不明なエラー";
};

const readBodyWithLimit = async (response: Response, maxBytes: number) => {
  const tooLarge = new Error(`${maxBytes / 1024 / 1024}MB を超えています`);
  if (Number(response.headers.get("content-length")) > maxBytes) {
    throw tooLarge;
  }
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
};

const readUrl = async (
  url: string,
  d1?: D1Database,
): Promise<SourceDocument> => {
  if (isXPostUrl(url)) {
    const post = await fetchXPostText(url, FETCH_TIMEOUT_MS);
    return {
      label: `URL: ${url}（X の投稿 @${post.authorName}）`,
      text: post.text,
    };
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "nepp-chan-knowledge-import/1.0",
      Accept: "text/html,application/pdf,image/*,text/plain",
      "Accept-Language": "ja",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (response.url && isLoginPage(new URL(response.url))) {
    throw new Error("ログインページに転送されました");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const buffer = await readBodyWithLimit(response, MAX_FETCH_BYTES);

  let text: string;
  if (isSupportedMimeType(mime)) {
    text = await convertToMarkdown(buffer, mime, d1);
  } else if (mime === "text/plain") {
    text = decodeHtml(buffer, contentType);
  } else if (HTML_MIME_TYPES.has(mime)) {
    const page = extractPageText(decodeHtml(buffer, contentType));
    text = [page.title, page.description, page.text].filter(Boolean).join("\n");
  } else {
    throw new Error(`未対応の形式です（${mime || "不明"}）`);
  }

  if (!text.trim()) {
    throw new Error("本文が空でした");
  }
  return { label: `URL: ${url}`, text };
};

type ReadResult =
  | { ok: true; doc: SourceDocument }
  | { ok: false; unreadable: Unreadable };

const readSources = async (input: CuratedDraftInput, deps: Deps) => {
  const inputUrls = input.urls.filter(isHttpUrl);
  const invalidUrls: ReadResult[] = input.urls
    .filter((url) => !isHttpUrl(url))
    .map((url) => ({
      ok: false,
      unreadable: { name: url, reason: "URL の形式が正しくありません" },
    }));

  const attempt = async (
    name: string,
    read: () => Promise<SourceDocument>,
  ): Promise<ReadResult> => {
    try {
      return { ok: true, doc: await read() };
    } catch (error) {
      return { ok: false, unreadable: { name, reason: toReason(error) } };
    }
  };

  const readOne = (url: string) =>
    attempt(url, async () => ({ ...(await readUrl(url, deps.d1)), url }));

  const fileTask = (file: File) =>
    attempt(file.name, async () => ({
      label: `画像・PDF: ${file.name}`,
      text: await convertToMarkdown(
        await file.arrayBuffer(),
        file.type,
        deps.d1,
      ),
    }));

  const [urlResults, fileResults] = await Promise.all([
    Promise.all(inputUrls.map(readOne)),
    Promise.all(input.files.map(fileTask)),
  ]);

  const results = [...invalidUrls, ...urlResults, ...fileResults];
  const sources = results.flatMap((r) => (r.ok ? [r.doc] : []));
  const unreadable = results.flatMap((r) => (r.ok ? [] : [r.unreadable]));
  const readUrls = sources.flatMap((doc) => (doc.url ? [doc.url] : []));
  const text = input.text?.trim();
  if (text) {
    sources.push({ label: "入力済みのテキスト", text });
  }

  return {
    sources: sources.map((doc) => ({
      ...doc,
      text: doc.text.slice(0, MAX_SOURCE_CHARS),
    })),
    unreadable,
    readUrls,
    inputUrls,
  };
};

const buildPrompt = (sources: SourceDocument[]) => {
  const perSource = Math.floor(MAX_PROMPT_CHARS / sources.length);
  return sources
    .map(
      (source, index) =>
        `## 資料 ${index + 1}（${source.label}）\n\n${source.text.slice(0, perSource)}`,
    )
    .join("\n\n");
};

export const toSlug = (
  slug: string,
  fallbackUrl?: string,
  now = new Date(),
) => {
  const normalized = slug
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  if (normalized) return normalized;

  if (fallbackUrl && isHttpUrl(fallbackUrl)) {
    const host = stripWww(new URL(fallbackUrl).hostname)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (host) return host;
  }

  const jst = new Date(now.getTime() + JST_OFFSET_MS).toISOString();
  return `curated-${jst.slice(0, 10).replace(/-/g, "")}-${jst.slice(11, 16).replace(":", "")}`;
};

export const buildCuratedMarkdown = (
  draft: CuratedDraftFields,
  options: { inputUrls: string[]; verifiedAt: string },
) => {
  const frontmatter: Record<string, string | number> = {
    title: draft.title,
    category: draft.category,
    source_type: "curated",
    source_authority: 2,
    verified_at: options.verifiedAt,
  };
  if (options.inputUrls[0]) frontmatter.url = options.inputUrls[0];

  const links = new Map<string, { label?: string; url: string }>();
  for (const url of options.inputUrls) {
    const key = normalizeUrl(url);
    if (!links.has(key)) links.set(key, { url });
  }
  for (const link of draft.sourceLinks) {
    const key = normalizeUrl(link.url);
    const existing = links.get(key);
    if (existing) {
      if (!existing.label && link.label) existing.label = link.label;
    } else {
      links.set(key, { label: link.label || undefined, url: link.url });
    }
  }

  const lines = [
    `# ${draft.title}`,
    "",
    `> ${draft.notice}`,
    "",
    draft.summary.trim(),
  ];
  if (links.size > 0) {
    lines.push("", "## 情報源", "");
    for (const link of links.values()) {
      lines.push(link.label ? `- ${link.label}: ${link.url}` : `- ${link.url}`);
    }
  }

  return matter.stringify(`${lines.join("\n")}\n`, frontmatter);
};

export const draftCurated = async (input: CuratedDraftInput, deps: Deps) => {
  const { sources, unreadable, readUrls, inputUrls } = await readSources(
    input,
    deps,
  );
  if (sources.length === 0) {
    throw new CuratedDraftError(unreadable);
  }

  const result = await curatedDrafterAgent.generate(buildPrompt(sources), {
    structuredOutput: { schema: CuratedDraftSchema },
  });
  if (deps.d1) {
    await recordLlmUsage(deps.d1, {
      model: result.response?.modelId ?? OPENAI_LITE,
      usage: result.totalUsage,
      source: "curated-draft",
      agent: "curated-drafter",
    });
  }
  const fields = result.object;
  if (!fields) {
    throw new Error("下書きの生成に失敗しました");
  }

  const content = buildCuratedMarkdown(fields, {
    inputUrls,
    verifiedAt: jstDateLabel(new Date()),
  });
  const key = `curated/${toSlug(fields.slug, inputUrls[0])}.md`;

  return { key, content, readUrls, unreadable };
};
