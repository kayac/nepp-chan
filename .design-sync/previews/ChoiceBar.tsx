import { ChoiceBar } from "@nepp-chan/shared";

const panel: React.CSSProperties = {
  maxWidth: 440,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

export const FestivalPoll = () => (
  <div style={panel}>
    <ChoiceBar
      choice="音威子府そば祭り"
      count={128}
      percentage={52}
      isLeading
    />
    <ChoiceBar
      choice="天塩川カヌーツーリング"
      count={74}
      percentage={30}
      isLeading={false}
    />
    <ChoiceBar
      choice="森のクラフト体験"
      count={43}
      percentage={18}
      isLeading={false}
    />
  </div>
);

export const CloseRace = () => (
  <div style={panel}>
    <ChoiceBar
      choice="冬の雪あかりイベントを続けてほしい"
      count={96}
      percentage={51}
      isLeading
    />
    <ChoiceBar
      choice="夏の星空観察会を増やしてほしい"
      count={92}
      percentage={49}
      isLeading={false}
    />
  </div>
);
