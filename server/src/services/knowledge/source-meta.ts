import matter from "gray-matter";
import { sha256Hex } from "~/lib/crypto";

const asDateString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
};

export const extractSourceMeta = (content: string) => {
  const { data } = matter(content);
  const authority = Number(data.source_authority);
  return {
    canonicalUrl: typeof data.url === "string" ? data.url : undefined,
    sourceType:
      typeof data.source_type === "string" ? data.source_type : undefined,
    sourceAuthority: Number.isFinite(authority) ? authority : undefined,
    verifiedAt: asDateString(data.verified_at),
  };
};

export type SourceMeta = ReturnType<typeof extractSourceMeta>;

export const buildSourceRecord = async (
  sourcePath: string,
  content: string,
) => ({
  sourcePath,
  ...extractSourceMeta(content),
  sourceHash: await sha256Hex(content),
});
