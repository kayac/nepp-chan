import { ThreadSidebar } from "@nepp-chan/shared";

const threads = [
  { id: "th-1", title: "そばの茹で方", updatedAt: "2024-05-14T09:30:00Z" },
  { id: "th-2", title: "観光スポット", updatedAt: "2024-05-12T15:00:00Z" },
  {
    id: "th-3",
    title: "冬のイベントについて",
    updatedAt: "2024-05-10T11:20:00Z",
  },
  { id: "th-4", title: null, updatedAt: "2024-05-15T08:00:00Z" },
] as never;

export const Open = () => (
  <div
    style={{
      position: "relative",
      height: 560,
      background: "var(--bg-app)",
      transform: "translateZ(0)",
      overflow: "hidden",
    }}
  >
    <ThreadSidebar
      isOpen={true}
      threads={threads}
      currentThreadId="th-2"
      isCreating={false}
      onClose={() => {}}
      onNewThread={() => {}}
      onSelectThread={() => {}}
      onRequestDelete={() => {}}
    />
  </div>
);
