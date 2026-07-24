import { SpeechBubble } from "@nepp-chan/shared";

const column: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  maxWidth: 520,
};

export const Assistant = () => (
  <div style={column}>
    <SpeechBubble variant="assistant">
      こんにちは！音威子府村のことなら何でも聞いてね🌲
      今日は朝から雪がしんしん降っているよ⛄
    </SpeechBubble>
  </div>
);

export const User = () => (
  <div style={{ ...column, alignItems: "flex-end" }}>
    <SpeechBubble variant="user">
      音威子府そばはどこで食べられるの？
    </SpeechBubble>
  </div>
);

export const Conversation = () => (
  <div style={column}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <SpeechBubble variant="user">
        おといねっぷ美術工芸高校ってどんな学校？
      </SpeechBubble>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <SpeechBubble variant="assistant">
        工芸科がある村立の高校だよ！全国から木工やデザインを学びたい生徒が集まって、寮で暮らしながらものづくりに打ち込んでいるんだ✨
      </SpeechBubble>
    </div>
  </div>
);

export const LongText = () => (
  <div style={column}>
    <SpeechBubble variant="assistant">
      冬の音威子府村は日本有数の豪雪地帯で、11月から4月ごろまで雪に包まれるよ。天塩川沿いの森が真っ白になる景色は本当にきれいなんだ。遊びに来るときは、滑りにくい靴とあたたかい上着を忘れずにね。駅の待合室であったかい音威子府そばを食べるのもおすすめだよ🍜
    </SpeechBubble>
  </div>
);
