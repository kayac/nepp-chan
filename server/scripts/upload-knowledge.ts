import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { glob } from "glob";

// 設定
const KNOWLEDGE_DIR = "../knowledge";
const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const ADMIN_KEY = process.env.ADMIN_KEY;
const EMBEDDING_MODEL = "google:text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100;

type ChunkMetadata = {
  source: string;
  section?: string;
  subsection?: string;
  content: string;
};

type VectorData = {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    clean: args.includes("--clean"),
    file: args.find((arg) => arg.startsWith("--file="))?.split("=")[1],
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(`
Usage: pnpm run knowledge:upload [options]

Options:
  --clean           全削除してからアップロード
  --file=<filename> 特定のファイルのみアップロード
  --help, -h        ヘルプを表示

Environment Variables:
  API_URL           APIのベースURL (default: http://localhost:8787)
  ADMIN_KEY         管理API認証キー (required)
  GOOGLE_GENERATIVE_AI_API_KEY  Google AI APIキー (required)
`);
};

const loadMarkdownFiles = async (
  specificFile?: string,
): Promise<{ filename: string; content: string }[]> => {
  const pattern = specificFile
    ? `${KNOWLEDGE_DIR}/${specificFile}`
    : `${KNOWLEDGE_DIR}/**/*.md`;

  const files = await glob(pattern);

  if (files.length === 0) {
    console.log(`No markdown files found in ${KNOWLEDGE_DIR}`);
    return [];
  }

  return files.map((filepath) => ({
    filename: basename(filepath),
    content: readFileSync(filepath, "utf-8"),
  }));
};

const chunkDocument = async (
  filename: string,
  content: string,
): Promise<{ text: string; metadata: ChunkMetadata }[]> => {
  const doc = MDocument.fromMarkdown(content);

  const chunks = await doc.chunk({
    strategy: "markdown",
    headers: [
      ["#", "title"],
      ["##", "section"],
      ["###", "subsection"],
    ],
  });

  return chunks.map((chunk) => ({
    text: chunk.text,
    metadata: {
      source: filename,
      section: chunk.metadata?.section as string | undefined,
      subsection: chunk.metadata?.subsection as string | undefined,
      content: chunk.text,
    },
  }));
};

const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: texts,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    },
  });

  return embeddings;
};

const upsertVectors = async (vectors: VectorData[]): Promise<void> => {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY environment variable is required");
  }

  const response = await fetch(`${API_BASE_URL}/admin/knowledge/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY,
    },
    body: JSON.stringify({ vectors }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upsert vectors: ${response.status} ${error}`);
  }

  const result = (await response.json()) as any;
  console.log(`  Upserted: ${result.message}`);
};

const deleteAllVectors = async (): Promise<void> => {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY environment variable is required");
  }

  const response = await fetch(`${API_BASE_URL}/admin/knowledge`, {
    method: "DELETE",
    headers: {
      "X-Admin-Key": ADMIN_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete vectors: ${response.status} ${error}`);
  }

  const result = (await response.json()) as any;
  console.log(`Deleted: ${result.message}`);
};

const deleteBySource = async (source: string): Promise<void> => {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY environment variable is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/admin/knowledge/${encodeURIComponent(source)}`,
    {
      method: "DELETE",
      headers: {
        "X-Admin-Key": ADMIN_KEY,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to delete vectors by source: ${response.status} ${error}`,
    );
  }

  const result = (await response.json()) as any;
  console.log(`Deleted by source: ${result.message}`);
};

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!ADMIN_KEY) {
    console.error("Error: ADMIN_KEY environment variable is required");
    process.exit(1);
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      "Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is required",
    );
    process.exit(1);
  }

  console.log("=== Knowledge Upload Script ===\n");

  // クリーンオプションの処理
  if (args.clean) {
    console.log("Cleaning existing vectors...");
    if (args.file) {
      await deleteBySource(args.file);
    } else {
      await deleteAllVectors();
    }
    console.log("");
  }

  // Markdownファイルの読み込み
  console.log("Loading markdown files...");
  const files = await loadMarkdownFiles(args.file);

  if (files.length === 0) {
    console.log("No files to process.");
    process.exit(0);
  }

  console.log(`Found ${files.length} file(s)\n`);

  // 各ファイルを処理
  for (const file of files) {
    console.log(`Processing: ${file.filename}`);

    // チャンク分割
    const chunks = await chunkDocument(file.filename, file.content);
    console.log(`  Chunks: ${chunks.length}`);

    if (chunks.length === 0) {
      console.log("  No chunks generated, skipping...\n");
      continue;
    }

    // Embedding生成
    console.log("  Generating embeddings...");
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

    // ベクトルデータの作成
    const vectors: VectorData[] = chunks.map((chunk, i) => ({
      id: `${file.filename}-${i}`,
      values: embeddings[i],
      metadata: chunk.metadata,
    }));

    // バッチでupsert
    console.log("  Upserting to Vectorize...");
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await upsertVectors(batch);
    }

    console.log("");
  }

  console.log("=== Upload Complete ===");
};

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
