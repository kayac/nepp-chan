const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  line: "LINE",
  admin: "管理者",
};

interface Props {
  conversations: number;
  messages: number;
  platforms: { platform: string; count: number }[];
}

export const StatCards = ({ conversations, messages, platforms }: Props) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="text-xs text-stone-500">会話数</div>
      <div className="text-xl font-bold text-stone-800">
        {conversations.toLocaleString()}
      </div>
    </div>
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="text-xs text-stone-500">メッセージ数</div>
      <div className="text-xl font-bold text-stone-800">
        {messages.toLocaleString()}
      </div>
    </div>
    {platforms.map((p) => (
      <div key={p.platform} className="bg-stone-50 rounded-lg p-3">
        <div className="text-xs text-stone-500">
          {PLATFORM_LABELS[p.platform] ?? p.platform}
        </div>
        <div className="text-xl font-bold text-stone-800">
          {p.count.toLocaleString()}
        </div>
      </div>
    ))}
  </div>
);
