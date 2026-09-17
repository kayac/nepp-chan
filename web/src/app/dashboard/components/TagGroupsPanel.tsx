import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";
import { useState } from "react";
import { GroupForm } from "~/app/dashboard/components/tag-groups/GroupForm";
import {
  groupLabel,
  KIND_LABELS,
  KIND_ORDER,
} from "~/app/dashboard/components/tag-groups/helpers";
import {
  useAssignTagGroups,
  useSetTagAlias,
  useTagGroups,
} from "~/app/dashboard/hooks/useTagGroups";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";

const GROUP_TAG_LIMIT = 12;
const EXCLUDE_GROUP_ID = "exclude";

export const TagGroupsPanel = () => {
  const { data, isLoading, error } = useTagGroups();
  const setAlias = useSetTagAlias();
  const assign = useAssignTagGroups();
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  if (isLoading) return <PanelLoading />;
  if (error) return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  if (!data) return null;

  const attributeGroups = data.groups.filter((g) => g.kind === "attribute");
  const groupsByKind = KIND_ORDER.map((kind) => ({
    kind,
    groups: data.groups.filter((g) => g.kind === kind),
  })).filter((section) => section.groups.length > 0);
  const axes = [
    ...new Set(attributeGroups.flatMap((g) => (g.axis ? [g.axis] : []))),
  ];
  const hasExclude = data.groups.some((g) => g.id === EXCLUDE_GROUP_ID);

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--fg-3)">
        声に付いたタグをグループにまとめる対応表です。分類は毎晩自動で進みます。判断できなかったものだけ、ここで割り当ててください。
      </p>

      <section className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-(--fg-1)">
            判断待ち{" "}
            <span className="text-(--fg-2)">{data.unassigned.length} 件</span>
          </h3>
          <div className="ml-auto flex items-center gap-3">
            {assign.isSuccess && (
              <span className="text-xs text-(--fg-2)">
                {assign.data.assigned} 件を振り分けました。
                {assign.data.unassigned} 件は判断できず未分類のままです
              </span>
            )}
            {assign.error && (
              <span className="text-xs text-(--danger)">
                {formatError(assign.error)}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => assign.mutate()}
              disabled={assign.isPending || data.unassigned.length === 0}
            >
              {assign.isPending
                ? "振り分け中..."
                : "未分類のタグを自動で振り分ける"}
            </Button>
          </div>
        </div>

        {data.unassigned.length === 0 ? (
          <p className="py-6 text-center text-sm text-(--fg-3)">
            判断待ちのタグはありません
          </p>
        ) : (
          <ul className="max-h-[60dvh] overflow-y-auto divide-y divide-(--border-1) pr-1">
            {data.unassigned.map((item) => (
              <li
                key={item.tag}
                className="flex flex-wrap items-center gap-3 py-2 text-sm"
              >
                <div className="min-w-48 flex-1">
                  <span className="font-medium text-(--fg-1)">{item.tag}</span>
                  <span className="ml-2 text-xs text-(--fg-3)">
                    {item.count} 件の声
                  </span>
                  {item.example && (
                    <p className="mt-0.5 truncate text-xs text-(--fg-3)">
                      例: 「{item.example}」
                    </p>
                  )}
                </div>
                <select
                  aria-label={`${item.tag} の割り当て先`}
                  className="rounded border border-(--border-1) bg-(--bg-base) px-2 py-1 text-xs"
                  defaultValue=""
                  disabled={setAlias.isPending}
                  onChange={(e) =>
                    setAlias.mutate({
                      tag: item.tag,
                      groupId: e.target.value || null,
                    })
                  }
                >
                  <option value="">グループを選ぶ</option>
                  {groupsByKind
                    .filter((section) => section.kind !== "exclude")
                    .map((section) => (
                      <optgroup
                        key={section.kind}
                        label={KIND_LABELS[section.kind]}
                      >
                        {section.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {groupLabel(g)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                {hasExclude && (
                  <button
                    type="button"
                    className="rounded-(--r-pill) bg-(--bg-sunken) px-2.5 py-1 text-xs text-(--fg-2) hover:bg-(--brand-soft)"
                    disabled={setAlias.isPending}
                    onClick={() =>
                      setAlias.mutate({
                        tag: item.tag,
                        groupId: EXCLUDE_GROUP_ID,
                      })
                    }
                  >
                    集計対象外にする
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-5 space-y-3">
          <h3 className="text-base font-semibold text-(--fg-1)">
            最近自動で振り分けたもの{" "}
            <span className="text-xs font-normal text-(--fg-3)">
              間違いがあれば戻せます
            </span>
          </h3>
          <ul className="divide-y divide-(--border-1)">
            {data.recent.map((r) => (
              <li key={r.tag} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">
                  {r.tag} <span className="text-(--fg-3)">→</span>{" "}
                  <span className="font-medium">{r.groupName}</span>
                </span>
                <button
                  type="button"
                  className="rounded-(--r-pill) bg-(--bg-sunken) px-2.5 py-1 text-xs text-(--fg-2) hover:bg-(--brand-soft)"
                  disabled={setAlias.isPending}
                  onClick={() => setAlias.mutate({ tag: r.tag, groupId: null })}
                >
                  判断待ちに戻す
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-(--fg-1)">グループ</h3>
          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAddingGroup((v) => !v)}
            >
              {isAddingGroup ? "閉じる" : "＋ グループを追加"}
            </Button>
          </div>
        </div>
        {isAddingGroup && (
          <div className="rounded border border-dashed border-(--border-2) p-3">
            <GroupForm axes={axes} onCreated={() => setIsAddingGroup(false)} />
          </div>
        )}
        {groupsByKind.map((section) => (
          <div key={section.kind} className="space-y-2">
            <h4 className="text-xs font-semibold text-(--fg-2)">
              {KIND_LABELS[section.kind]}
            </h4>
            <ul className="grid gap-2 sm:grid-cols-2">
              {section.groups.map((group) => (
                <li
                  key={group.id}
                  className="rounded border border-(--border-1) p-3 text-xs"
                >
                  <div className="mb-1.5 font-medium text-(--fg-1)">
                    {groupLabel(group)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.tags.slice(0, GROUP_TAG_LIMIT).map((t) => (
                      <span
                        key={t.tag}
                        className="inline-flex items-center gap-1 rounded-(--r-pill) bg-(--bg-sunken) pl-2 pr-1 py-0.5 text-(--fg-2)"
                      >
                        {t.tag} <span className="text-(--fg-3)">{t.count}</span>
                        <button
                          type="button"
                          aria-label={`${t.tag} を判断待ちに戻す`}
                          className="rounded-full p-0.5 text-(--fg-3) hover:bg-(--brand-soft) hover:text-(--fg-1)"
                          disabled={setAlias.isPending}
                          onClick={() =>
                            setAlias.mutate({ tag: t.tag, groupId: null })
                          }
                        >
                          <XMarkIcon className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {group.tags.length > GROUP_TAG_LIMIT && (
                      <span className="text-(--fg-3)">
                        他 {group.tags.length - GROUP_TAG_LIMIT} 語
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
};
