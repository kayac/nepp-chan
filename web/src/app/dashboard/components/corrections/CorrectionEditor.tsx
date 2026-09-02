import { useState } from "react";
import { useUpdateCorrection } from "~/app/dashboard/hooks/useCorrections";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import type { KnowledgeCorrection } from "~/types";

type Props = {
  correction: KnowledgeCorrection;
  onClose: () => void;
};

export const CorrectionEditor = ({ correction, onClose }: Props) => {
  const [body, setBody] = useState(correction.body);
  const updateMutation = useUpdateCorrection();

  const handleSubmit = () => {
    updateMutation.mutate(
      { id: correction.id, body: body.trim() },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="space-y-2">
      <textarea
        aria-label="訂正の本文"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        className="w-full rounded-lg border border-stone-200 p-2 text-sm"
      />
      {updateMutation.isError && (
        <ErrorBanner>{formatError(updateMutation.error)}</ErrorBanner>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={
            updateMutation.isPending ||
            !body.trim() ||
            body.trim() === correction.body
          }
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {updateMutation.isPending ? "反映中..." : "保存して再反映する"}
        </button>
        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={onClose}
          className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
        >
          やめる
        </button>
      </div>
    </div>
  );
};
