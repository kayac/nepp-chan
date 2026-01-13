import { makeAssistantToolUI } from "@assistant-ui/react";
import { BookOpenIcon, FileTextIcon, SearchIcon } from "lucide-react";

type KnowledgeArgs = {
  query: string;
};

type KnowledgeResult = {
  results: {
    content: string;
    score: number;
    source: string;
    title?: string;
    section?: string;
    subsection?: string;
  }[];
  error?: string;
};

const LoadingState = ({ query }: { query: string }) => (
  <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
    <div className="flex items-center gap-3">
      <SearchIcon className="size-5 animate-pulse text-emerald-500" />
      <span className="text-sm text-(--color-text-muted)">
        「{query}」を検索中...
      </span>
    </div>
    <div className="mt-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-emerald-100" />
      ))}
    </div>
  </div>
);

const ResultCard = ({
  result,
  index,
}: {
  result: KnowledgeResult["results"][0];
  index: number;
}) => (
  <div
    className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        {result.title ? (
          <BookOpenIcon className="size-4 text-emerald-600" />
        ) : (
          <FileTextIcon className="size-4 text-emerald-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {result.title && (
          <div className="font-medium text-gray-800">{result.title}</div>
        )}
        {(result.section || result.subsection) && (
          <div className="text-xs text-emerald-600">
            {[result.section, result.subsection].filter(Boolean).join(" > ")}
          </div>
        )}
        <p className="mt-1 line-clamp-3 text-sm text-gray-600">
          {result.content}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="rounded bg-gray-100 px-1.5 py-0.5">
            {result.source}
          </span>
          <span>関連度: {Math.round(result.score * 100)}%</span>
        </div>
      </div>
    </div>
  </div>
);

export const KnowledgeSearchToolUI = makeAssistantToolUI<
  KnowledgeArgs,
  KnowledgeResult
>({
  toolName: "knowledge-search",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return (
        <div className="my-4">
          <LoadingState query={args.query} />
        </div>
      );
    }

    if (status.type === "incomplete") {
      return (
        <div className="my-4 rounded-xl bg-red-50 p-4 text-red-600">
          ナレッジ検索に失敗しました
        </div>
      );
    }

    if (!result) return null;

    if (result.error) {
      return (
        <div className="my-4 rounded-xl bg-yellow-50 p-4 text-yellow-700">
          検索エラー: {result.error}
        </div>
      );
    }

    if (result.results.length === 0) {
      return (
        <div className="my-4 rounded-xl bg-gray-50 p-4 text-gray-600">
          「{args.query}」に関する情報が見つかりませんでした
        </div>
      );
    }

    return (
      <div className="my-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <SearchIcon className="size-4" />
          <span>
            「{args.query}」の検索結果（{result.results.length}件）
          </span>
        </div>
        <div className="space-y-2">
          {result.results.map((r, i) => (
            <ResultCard key={`${r.source}-${i}`} result={r} index={i} />
          ))}
        </div>
      </div>
    );
  },
});
