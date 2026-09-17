import { Button } from "@nepp-chan/shared/ui/Button";
import { useState } from "react";
import {
  useAssignTagGroups,
  useCreateTagGroup,
  useSetTagAlias,
  useTagGroups,
} from "~/app/dashboard/hooks/useTagGroups";
import { formatError } from "~/components/ui/ErrorBanner";

const UNASSIGNED_LIMIT = 30;
const GROUP_TAG_LIMIT = 12;
const UNASSIGNED_VALUE = "";

const KIND_LABELS = {
  attribute: "属性",
  topic: "話題",
  exclude: "除外",
} as const;
type Kind = keyof typeof KIND_LABELS;

const GroupForm = ({ axes }: { axes: string[] }) => {
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

export const TagAssignment = () => {
  const { data } = useTagGroups();
  const setAlias = useSetTagAlias();
  const assign = useAssignTagGroups();
  const [showAllGroups, setShowAllGroups] = useState(false);

  if (!data) return null;

  const attributeGroups = data.groups.filter((g) => g.kind === "attribute");
  const visibleGroups = showAllGroups ? data.groups : attributeGroups;
  const axes = [
    ...new Set(attributeGroups.flatMap((g) => (g.axis ? [g.axis] : []))),
  ];

  return (
    <details className="mt-6 rounded-lg border border-(--border-1) p-4">
      <summary className="cursor-pointer text-sm font-medium text-(--fg-1)">
        タグの割り当て（未分類 {data.unassigned.length} 件）
      </summary>

      <div className="mt-4 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => assign.mutate()}
            disabled={assign.isPending || data.unassigned.length === 0}
          >
            {assign.isPending ? "振り分け中..." : "LLM で振り分け"}
          </Button>
          {assign.isSuccess && (
            <span className="text-xs text-(--fg-2)">
              {assign.data.assigned} 件を割り当て、{assign.data.unassigned}{" "}
              件は判断できず未分類
            </span>
          )}
          {assign.error && (
            <span className="text-xs text-(--danger)">
              {formatError(assign.error)}
            </span>
          )}
        </div>

        {data.unassigned.length > 0 && (
          <section className="space-y-2">
            <h5 className="text-xs font-semibold text-(--fg-2)">
              未分類タグ（件数順）
            </h5>
            <ul className="space-y-1">
              {data.unassigned.slice(0, UNASSIGNED_LIMIT).map((item) => (
                <li key={item.tag} className="flex items-center gap-3 text-sm">
                  <span className="min-w-32 text-(--fg-1)">
                    {item.tag}{" "}
                    <span className="text-xs text-(--fg-3)">{item.count}</span>
                  </span>
                  <select
                    aria-label={`${item.tag} の割り当て先`}
                    className="rounded border border-(--border-1) bg-(--bg-base) px-2 py-1 text-xs"
                    defaultValue={UNASSIGNED_VALUE}
                    disabled={setAlias.isPending}
                    onChange={(e) =>
                      setAlias.mutate({
                        tag: item.tag,
                        groupId: e.target.value || null,
                      })
                    }
                  >
                    <option value={UNASSIGNED_VALUE}>未分類</option>
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.axis ? `${g.axis} / ` : ""}
                        {g.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h5 className="text-xs font-semibold text-(--fg-2)">
            グループを追加
          </h5>
          <GroupForm axes={axes} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-(--fg-2)">
              グループと所属タグ
            </h5>
            <button
              type="button"
              className="text-xs text-(--brand) underline"
              onClick={() => setShowAllGroups((v) => !v)}
            >
              {showAllGroups ? "属性グループだけ表示" : "話題・除外も表示"}
            </button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibleGroups.map((group) => (
              <li
                key={group.id}
                className="rounded border border-(--border-1) p-2 text-xs"
              >
                <div className="mb-1 font-medium text-(--fg-1)">
                  {group.axis ? `${group.axis} / ` : ""}
                  {group.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.tags.slice(0, GROUP_TAG_LIMIT).map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      title="クリックで未分類に戻す"
                      className="rounded-(--r-pill) bg-(--bg-sunken) px-2 py-0.5 text-(--fg-2) hover:bg-(--brand-soft)"
                      disabled={setAlias.isPending}
                      onClick={() =>
                        setAlias.mutate({ tag: t.tag, groupId: null })
                      }
                    >
                      {t.tag} <span className="text-(--fg-3)">{t.count}</span>
                    </button>
                  ))}
                  {group.tags.length > GROUP_TAG_LIMIT && (
                    <span className="text-(--fg-3)">
                      他 {group.tags.length - GROUP_TAG_LIMIT} 件
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
};
