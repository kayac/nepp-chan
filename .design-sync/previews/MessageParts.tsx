import { MessageParts, SpeechBubble } from "@nepp-chan/shared";

const container: React.CSSProperties = {
  maxWidth: 560,
  padding: 16,
};

export const TextPart = () => (
  <div style={container}>
    <SpeechBubble variant="assistant">
      <MessageParts
        message={{
          id: "m1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "道の駅おといねっぷでは、木工クラフトのお土産や特産品が買えるよ！村の玄関口だから、まず立ち寄ってみてね🌲",
            },
          ],
        }}
      />
    </SpeechBubble>
  </div>
);

export const MarkdownPart = () => (
  <div style={container}>
    <SpeechBubble variant="assistant">
      <MessageParts
        message={{
          id: "m2",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `### 村の四季の楽しみ

1. **春**: 天塩川沿いの新緑さんぽ
2. **夏**: 美術工芸高校の作品展めぐり
3. **冬**: 一面の雪景色とクロスカントリースキー`,
            },
          ],
        }}
      />
    </SpeechBubble>
  </div>
);

export const TextAndToolParts = () => (
  <div style={container}>
    <SpeechBubble variant="assistant">
      <MessageParts
        message={{
          id: "m3",
          role: "assistant",
          parts: [
            {
              type: "tool-searchKnowledge",
              toolCallId: "call-mp-1",
              state: "output-available",
              input: { query: "音威子府駅 そば 営業" },
              output: { results: ["音威子府駅の立ち食いそば案内"] },
            } as never,
            {
              type: "text",
              text: "調べてみたよ！音威子府駅のおそばは長く愛されてきた名物なんだ。村内のお店では今も黒い麺の音威子府そばが味わえるよ🍜",
            },
          ],
        }}
      />
    </SpeechBubble>
  </div>
);
