import type { ReviewDetail } from "~/types";

type Props = {
  evidence: NonNullable<ReviewDetail["archivedEvidence"]>;
};

export const ArchivedEvidence = ({ evidence }: Props) => (
  <div className="space-y-2">
    <p className="text-xs text-stone-500">
      会話と検索記録は保管期限を過ぎています。判断時に記録した内容を表示しています（個人情報は伏せてあります）
    </p>
    {evidence.question && (
      <div className="rounded-lg p-3 text-sm bg-blue-50 text-blue-800 ml-8">
        <div className="text-xs font-medium mb-1 opacity-70">ユーザー</div>
        <div className="whitespace-pre-wrap">{evidence.question}</div>
      </div>
    )}
    {evidence.answer && (
      <div className="rounded-lg p-3 text-sm bg-stone-50 text-stone-700 mr-8">
        <div className="text-xs font-medium mb-1 opacity-70">ねっぷちゃん</div>
        <div className="whitespace-pre-wrap">{evidence.answer}</div>
      </div>
    )}
    {evidence.runs.length > 0 && (
      <ul className="space-y-1">
        {evidence.runs.map((run) => (
          <li
            key={`${run.query}-${run.sources.join(",")}`}
            className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600"
          >
            <div className="font-medium text-stone-700">
              検索: {run.query || "（記録なし）"}
            </div>
            {run.sources.length === 0 ? (
              <span className="text-red-600">ヒットなし</span>
            ) : (
              <span className="font-mono">{run.sources.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);
