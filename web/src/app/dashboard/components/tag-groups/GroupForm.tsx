import { Button } from "@nepp-chan/shared/ui/Button";
import { useState } from "react";
import { useCreateTagGroup } from "~/app/dashboard/hooks/useTagGroups";
import { formatError } from "~/components/ui/ErrorBanner";
import { KIND_LABELS, type TagGroupKind } from "./helpers";

type Kind = TagGroupKind;

interface Props {
  axes: string[];
  onCreated?: () => void;
}

export const GroupForm = ({ axes, onCreated }: Props) => {
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
              onCreated?.();
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
