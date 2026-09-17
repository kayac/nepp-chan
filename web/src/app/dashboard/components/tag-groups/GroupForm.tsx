import { Button } from "@nepp-chan/shared/ui/Button";
import { useState } from "react";
import { useCreateTagGroup } from "~/app/dashboard/hooks/useTagGroups";
import { formatError } from "~/components/ui/ErrorBanner";

const KIND_LABELS = {
  attribute: "話者の属性",
  topic: "話題",
  exclude: "集計に使わない",
} as const;
type Kind = keyof typeof KIND_LABELS;

interface Props {
  axes: string[];
}

export const GroupForm = ({ axes }: Props) => {
  const create = useCreateTagGroup();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("attribute");
  const [axis, setAxis] = useState("");
  const canSubmit =
    name.trim().length > 0 && (kind !== "attribute" || axis.trim().length > 0);

  return (
    <form
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          {
            name: name.trim(),
            kind,
            axis: kind === "attribute" ? axis.trim() : null,
          },
          {
            onSuccess: () => {
              setName("");
              setAxis("");
            },
          },
        );
      }}
    >
      <label className="flex flex-col gap-1">
        グループ名
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-(--border-1) bg-(--bg-base) px-2 py-1"
          placeholder="例: 農家"
        />
      </label>
      <label className="flex flex-col gap-1">
        種別
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="rounded border border-(--border-1) bg-(--bg-base) px-2 py-1"
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {kind === "attribute" && (
        <label className="flex flex-col gap-1">
          軸
          <input
            value={axis}
            onChange={(e) => setAxis(e.target.value)}
            list="tag-group-axes"
            className="rounded border border-(--border-1) bg-(--bg-base) px-2 py-1"
            placeholder="例: 立場"
          />
          <datalist id="tag-group-axes">
            {axes.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
      )}
      <Button type="submit" size="sm" disabled={!canSubmit || create.isPending}>
        グループを追加
      </Button>
      {create.error && (
        <span className="text-(--danger)">{formatError(create.error)}</span>
      )}
    </form>
  );
};
