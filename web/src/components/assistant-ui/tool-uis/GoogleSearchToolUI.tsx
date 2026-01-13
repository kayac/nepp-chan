import { makeAssistantToolUI } from "@assistant-ui/react";
import { ExternalLinkIcon, GlobeIcon, SearchIcon } from "lucide-react";
import type { FC } from "react";

type SearchArgs = {
  query: string;
};

type SearchResult = {
  results: {
    title: string;
    snippet: string;
    url: string;
  }[];
  error?: string;
  source: string;
};

const LoadingState: FC<{ query: string }> = ({ query }) => (
  <div className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 p-4">
    <div className="flex items-center gap-3">
      <GlobeIcon className="size-5 animate-spin text-violet-500" />
      <span className="text-sm text-(--color-text-muted)">
        「{query}」をWeb検索中...
      </span>
    </div>
    <div className="mt-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-violet-100" />
      ))}
    </div>
  </div>
);

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
};

const ResultCard: FC<{
  result: SearchResult["results"][0];
  index: number;
}> = ({ result, index }) => (
  <a
    href={result.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block rounded-lg border border-violet-100 bg-white p-3 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <GlobeIcon className="size-4 shrink-0 text-violet-500" />
          <span className="truncate text-xs text-gray-500">
            {getDomain(result.url)}
          </span>
        </div>
        <h4 className="mt-1 line-clamp-1 font-medium text-violet-700">
          {result.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
          {result.snippet}
        </p>
      </div>
      <ExternalLinkIcon className="size-4 shrink-0 text-gray-400" />
    </div>
  </a>
);

export const GoogleSearchToolUI = makeAssistantToolUI<SearchArgs, SearchResult>(
  {
    toolName: "searchGoogleTool",
    render: ({ args, result, status }) => {
      if (status.type === "running") {
        return <LoadingState query={args.query} />;
      }

      if (status.type === "incomplete") {
        return (
          <div className="rounded-xl bg-red-50 p-4 text-red-600">
            Web検索に失敗しました
          </div>
        );
      }

      if (!result) return null;

      if (result.error) {
        const errorMessage =
          result.error === "RATE_LIMIT_EXCEEDED"
            ? "検索回数の上限に達しました。しばらくお待ちください。"
            : result.error === "API_KEY_MISSING"
              ? "検索機能が設定されていません"
              : `検索エラー: ${result.error}`;

        return (
          <div className="rounded-xl bg-yellow-50 p-4 text-yellow-700">
            {errorMessage}
          </div>
        );
      }

      if (result.results.length === 0) {
        return (
          <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
            「{args.query}」に関する検索結果が見つかりませんでした
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-violet-600">
            <SearchIcon className="size-4" />
            <span>Web検索結果（{result.results.length}件）</span>
          </div>
          <div className="space-y-2">
            {result.results.slice(0, 5).map((r, i) => (
              <ResultCard key={r.url} result={r} index={i} />
            ))}
          </div>
          <div className="text-right text-xs text-gray-400">
            {result.source}
          </div>
        </div>
      );
    },
  },
);
