import { ChatMarkdown, SpeechBubble } from "@nepp-chan/shared";

const assistantText = `おといねっぷ美術工芸高校のことだね！✨

- **場所**: 音威子府村の中心部
- **特色**: 工芸科があって、木工やデザインを専門的に学べるよ
- **暮らし**: 全国から集まった生徒が寮生活を送っているんだ

くわしくは [村の公式サイト](https://www.vill.otoineppu.hokkaido.jp/) も見てみてね🌲`;

const userText = "音威子府村の**特産品**って何があるの？";

export const AssistantVariant = () => (
  <div style={{ maxWidth: 480, padding: 16 }}>
    <SpeechBubble variant="assistant">
      <ChatMarkdown text={assistantText} variant="assistant" />
    </SpeechBubble>
  </div>
);

export const UserVariant = () => (
  <div style={{ maxWidth: 480, padding: 16 }}>
    <SpeechBubble variant="user">
      <ChatMarkdown text={userText} variant="user" />
    </SpeechBubble>
  </div>
);

export const RichContent = () => (
  <div style={{ maxWidth: 520, padding: 16 }}>
    <SpeechBubble variant="assistant">
      <ChatMarkdown
        variant="assistant"
        text={`## 音威子府そばの楽しみ方

1. まずは**ざるそば**で香りを楽しむ
2. 寒い日は温かいかけそばもおすすめ
3. お土産には乾麺セットが人気だよ

> 黒っぽい麺は、そばの実を丸ごと挽いているからなんだ🍜`}
      />
    </SpeechBubble>
  </div>
);
