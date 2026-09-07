import { MDocument } from "@mastra/rag";
import matter from "gray-matter";
import { logger } from "~/lib/logger";

const MIN_CHUNK_LENGTH = 50;
const CHUNK_MAX_SIZE = 1000;
const CHUNK_OVERLAP = 100;

export type ChunkMetadata = {
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
  content: string;
  [key: string]: string | number | boolean | string[] | undefined;
};

type HeaderMetadata = {
  title?: string;
  section?: string;
  subsection?: string;
};

const headerPrefix = (meta: HeaderMetadata) =>
  [meta.title, meta.section, meta.subsection]
    .filter((v): v is string => typeof v === "string")
    .join(" > ");

export const chunkDocument = async (filename: string, content: string) => {
  const { data: frontmatter, content: body } = matter(content);
  const doc = MDocument.fromMarkdown(body);

  await doc.chunk({
    strategy: "markdown",
    headers: [
      ["#", "title"],
      ["##", "section"],
      ["###", "subsection"],
    ],
  });
  await doc.chunk({
    strategy: "recursive",
    maxSize: CHUNK_MAX_SIZE,
    overlap: CHUNK_OVERLAP,
  });

  const allTexts = doc.getText();
  const allMetadata = doc.getMetadata() as HeaderMetadata[];

  const kept = allTexts
    .map((text, i) => ({ text, meta: allMetadata[i] ?? {} }))
    .filter(({ text }) => text.length >= MIN_CHUNK_LENGTH)
    .map(({ text, meta }) => {
      const prefix = headerPrefix(meta);
      return { text: prefix ? `${prefix}\n\n${text}` : text, meta };
    });

  const texts = kept.map(({ text }) => text);
  const metadata: ChunkMetadata[] = kept.map(({ text, meta }) => ({
    ...frontmatter,
    source: filename,
    title: meta.title,
    section: meta.section,
    subsection: meta.subsection,
    content: text,
  }));

  logger.info(
    `[Knowledge Sync] ${filename}: ${allTexts.length} chunks -> ${texts.length} after filtering (min ${MIN_CHUNK_LENGTH} chars)`,
  );

  return { texts, metadata };
};
