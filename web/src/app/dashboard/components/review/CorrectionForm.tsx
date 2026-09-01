import { useState } from "react";
import { useCreateCorrection } from "~/app/dashboard/hooks/useCorrections";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";

type Props = {
  answerRunId: string;
  sourceOptions: string[];
};

export const CorrectionForm = ({ answerRunId, sourceOptions }: Props) => {
  const [correctsSourcePath, setCorrectsSourcePath] = useState(
    sourceOptions[0] ?? "",
  );
  const [body, setBody] = useState("");
  const createMutation = useCreateCorrection();

  const handleSubmit = () => {
    createMutation.mutate({
      correctsSourcePath,
      body: body.trim(),
      answerRunId,
    });
  };

  if (createMutation.isSuccess) {
    return (
      <div className="bg-teal-50 text-teal-700 rounded-lg p-3 text-sm">
        訂正を発行しました。次回の回答から反映されます
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="correction-source"
          className="block text-xs font-medium text-stone-600 mb-1"
        >
          訂正する情報源
        </label>
        <select
          id="correction-source"
          value={correctsSourcePath}
          onChange={(event) => setCorrectsSourcePath(event.target.value)}
          className="w-full rounded-lg border border-stone-200 p-2 text-sm bg-white"
        >
          {sourceOptions.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="正しい内容（例: 村営バスは土曜は運休です）"
        rows={4}
        className="w-full rounded-lg border border-stone-200 p-2 text-sm"
      />
      {createMutation.isError && (
        <ErrorBanner>{formatError(createMutation.error)}</ErrorBanner>
      )}
      <button
        type="button"
        disabled={
          createMutation.isPending || !body.trim() || !correctsSourcePath
        }
        onClick={handleSubmit}
        className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {createMutation.isPending ? "発行中..." : "訂正を発行する"}
      </button>
    </div>
  );
};
