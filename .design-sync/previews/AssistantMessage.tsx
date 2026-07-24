import { AssistantMessage, PendingAssistantMessage } from "@nepp-chan/shared";

const thread: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  padding: "0 16px",
  ["--thread-max-width" as string]: "42rem",
};

// AssistantHeader が参照する /mascot/icon.png は generate-asset-css.mjs の
// シム対象から除外されておりプレビューでは 404 になるため、ここでローカルにシムする
const ICON_WEBP =
  "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";

const IconShim = () => (
  <style>{`img[src="/mascot/icon.png"] { content: url("data:image/webp;base64,${ICON_WEBP}"); }`}</style>
);

export const Answer = () => (
  <div style={thread}>
    <IconShim />
    <AssistantMessage
      isLast={false}
      message={{
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "おといねっぷ美術工芸高校は、音威子府村にある村立の高校だよ！工芸科があって、全国から木工やデザインを学びたい生徒が集まってくるんだ🌲 寮で暮らしながらものづくりに打ち込める、ちょっと特別な学校なんだよ✨",
          },
        ],
      }}
    />
  </div>
);

export const MarkdownAnswer = () => (
  <div style={thread}>
    <IconShim />
    <AssistantMessage
      isLast={true}
      message={{
        id: "a2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `音威子府そばのおすすめの楽しみ方を紹介するね！

- **ざるそば**: まずはそのまま、そばの香りを楽しむ
- **かけそば**: 雪の日はあったかいおつゆで
- **お土産**: 乾麺セットが人気だよ

> 黒っぽい麺は、そばの実を甘皮ごと挽いているからなんだ🍜`,
          },
        ],
      }}
    />
  </div>
);

export const WithToolPart = () => (
  <div style={thread}>
    <IconShim />
    <AssistantMessage
      isLast={true}
      message={{
        id: "a3",
        role: "assistant",
        parts: [
          {
            type: "tool-searchKnowledge",
            toolCallId: "call-1",
            state: "output-available",
            input: { query: "音威子府村 冬 イベント" },
            output: {
              results: ["冬のイベント情報", "クロスカントリースキーコース"],
            },
          } as never,
          {
            type: "text",
            text: "調べてみたよ！冬の音威子府村では、クロスカントリースキーのコースが開放されるんだ。天塩川沿いの雪原を滑るのは気持ちいいよ⛄",
          },
        ],
      }}
    />
  </div>
);

export const Pending = () => (
  <div style={thread}>
    <IconShim />
    <PendingAssistantMessage />
  </div>
);
