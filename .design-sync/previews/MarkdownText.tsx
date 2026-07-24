import { MarkdownText } from "@nepp-chan/shared";

const card: React.CSSProperties = {
  maxWidth: 560,
  padding: 20,
  margin: 16,
  background: "var(--paper-0)",
  border: "1px solid var(--paper-200)",
  borderRadius: 12,
};

export const HeadingsAndText = () => (
  <div style={card}>
    <MarkdownText
      text={`## 音威子府村ってどんなところ？

北海道でいちばん人口が少ない村だよ。天塩川と森に囲まれた、雪深くて静かな村なんだ。

### 村の自慢

黒っぽい麺の**音威子府そば**と、木のぬくもりを感じる*工芸のまちづくり*が有名だよ🌲`}
    />
  </div>
);

export const ListsAndLinks = () => (
  <div style={card}>
    <MarkdownText
      text={`村での過ごし方はこんな感じ！

- **春**: 天塩川沿いの新緑さんぽ
- **夏**: 美術工芸高校の卒業制作展めぐり
- **冬**: 一面の雪景色とクロスカントリースキー

おすすめの回り方はこの順番だよ。

1. 道の駅おといねっぷに立ち寄る
2. 音威子府そばでお昼ごはん
3. エコミュージアムおさしまセンターで砂澤ビッキの彫刻を見る

> くわしくは[村の公式サイト](https://www.vill.otoineppu.hokkaido.jp/)を見てみてね🌲`}
    />
  </div>
);

export const Table = () => (
  <div style={card}>
    <MarkdownText
      text={`音威子府村へのアクセスをまとめたよ！

| 手段 | 経路 | 所要時間 |
| --- | --- | --- |
| JR宗谷本線 | 旭川駅 → 音威子府駅 | 約2時間30分 |
| 車 | 旭川から国道40号を北上 | 約2時間 |
| 都市間バス | 札幌 → 音威子府 | 約4時間30分 |

冬は雪で時間がかかることもあるから、余裕をもって来てね⛄`}
    />
  </div>
);

export const CodeBlock = () => (
  <div style={card}>
    <MarkdownText
      text={`村のオープンデータは \`village.json\` として公開しているよ。

\`\`\`json
{
  "village": "音威子府村",
  "population": 662,
  "specialty": ["音威子府そば", "木工芸"],
  "highSchool": "おといねっぷ美術工芸高校"
}
\`\`\``}
    />
  </div>
);
