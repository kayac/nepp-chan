import { useState } from "react";
import { useAudiences } from "~/app/dashboard/hooks/useAnalytics";
import { FolderTabs } from "~/components/ui/FolderTabs";
import { SENTIMENT_SERIES } from "~/lib/chart-helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";
import { TagAssignment } from "./TagAssignment";

type Audiences = NonNullable<ReturnType<typeof useAudiences>["data"]>;
type AudienceGroup = Audiences["axes"][number]["groups"][number];

export type ShowVoices = (
  group: { id: string; name: string },
  topic?: string,
) => void;

interface Props {
  onShowVoices?: ShowVoices;
}

const TOPIC_LIMIT = 5;

const SentimentBar = ({
  topic,
  onClick,
}: {
  topic: AudienceGroup["topics"][number];
  onClick?: () => void;
}) => {
  const total = SENTIMENT_SERIES.reduce((sum, s) => sum + topic[s.key], 0);
  const Row = onClick ? "button" : "div";
  return (
    <Row
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2 text-xs ${onClick ? "rounded hover:bg-(--bg-sunken)" : ""}`}
    >
      <span className="w-12 shrink-0 text-left text-(--fg-2)">
        {topic.topic}
      </span>
      <div className="flex h-3 flex-1 overflow-hidden rounded-sm bg-(--bg-sunken)">
        {SENTIMENT_SERIES.map((s) =>
          topic[s.key] > 0 ? (
            <div
              key={s.key}
              title={`${s.label} ${topic[s.key]}`}
              style={{
                width: `${(topic[s.key] / total) * 100}%`,
                background: s.color,
              }}
            />
          ) : null,
        )}
      </div>
      <span className="w-8 shrink-0 text-right text-(--fg-3)">{total}</span>
    </Row>
  );
};

const sentimentColor = (sentiment: string) =>
  SENTIMENT_SERIES.find((s) => s.key === sentiment)?.color ?? "#c8d9e8";

const GroupCard = ({
  group,
  onShowVoices,
}: {
  group: AudienceGroup;
  onShowVoices?: ShowVoices;
}) => (
  <article className="rounded-lg border border-(--border-1) bg-(--bg-base) p-4 space-y-3">
    <header className="flex items-baseline justify-between gap-2">
      <h4 className="font-semibold text-(--fg-1)">{group.name}</h4>
      <span className="text-xs text-(--fg-3)">
        {group.count.toLocaleString()} 件
        {onShowVoices && (
          <button
            type="button"
            onClick={() => onShowVoices({ id: group.id, name: group.name })}
            className="ml-2 text-(--brand) underline"
          >
            声を見る
          </button>
        )}
      </span>
    </header>

    <div className="space-y-1.5">
      {group.topics.slice(0, TOPIC_LIMIT).map((topic) => (
        <SentimentBar
          key={topic.topic}
          topic={topic}
          onClick={
            onShowVoices
              ? () =>
                  onShowVoices({ id: group.id, name: group.name }, topic.topic)
              : undefined
          }
        />
      ))}
    </div>

    {group.entities.length > 0 && (
      <ul className="flex flex-wrap gap-1.5">
        {group.entities.map((e) => (
          <li
            key={e.name}
            className="rounded-(--r-pill) bg-(--brand-soft) px-2 py-0.5 text-xs text-(--fg-1)"
          >
            {e.name} <span className="text-(--fg-3)">{e.count}</span>
          </li>
        ))}
      </ul>
    )}

    {group.samples.length > 0 && (
      <ul className="space-y-1.5">
        {group.samples.map((s) => (
          <li key={s.content} className="flex gap-2 text-xs text-(--fg-2)">
            <span
              aria-hidden="true"
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: sentimentColor(s.sentiment) }}
            />
            <span>{s.content}</span>
          </li>
        ))}
      </ul>
    )}
  </article>
);

export const AudienceSection = ({ onShowVoices }: Props) => {
  const { data, isLoading, error } = useAudiences();
  const [selectedAxis, setSelectedAxis] = useState<string | null>(null);

  const axes = data?.axes.map((a) => a.axis) ?? [];
  const activeAxis =
    selectedAxis && axes.includes(selectedAxis) ? selectedAxis : axes[0];
  const groups = data?.axes.find((a) => a.axis === activeAxis)?.groups ?? [];

  return (
    <SectionCard
      title="話者別の関心と課題"
      description="タグをグループにまとめ、層ごとに話題と感情を見る。1 件の声が複数の層に入るため件数は重なる"
    >
      {isLoading && <SectionLoading />}
      {error && <SectionError error={error} />}
      {data && axes.length === 0 && (
        <SectionEmpty>属性グループに入る声がまだありません</SectionEmpty>
      )}
      {data && activeAxis && (
        <div className="space-y-4">
          <FolderTabs
            label="属性の軸"
            tabs={axes.map((axis) => ({ value: axis, label: axis }))}
            selected={activeAxis}
            onSelect={setSelectedAxis}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onShowVoices={onShowVoices}
              />
            ))}
          </div>
        </div>
      )}
      {data && <TagAssignment />}
    </SectionCard>
  );
};
