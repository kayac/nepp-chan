import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonaPeriodSummary } from "./PersonaPeriodSummary";

const sentiment = (positive = 0, negative = 0, request = 0, neutral = 0) => ({
  positive,
  negative,
  request,
  neutral,
});

describe("PersonaPeriodSummary", () => {
  it("0 件のときは空メッセージを表示する", () => {
    render(
      <PersonaPeriodSummary
        data={{ totalCount: 0, ageSentiment: [], topics: [] }}
      />,
    );

    expect(
      screen.getByText("この期間の会話に由来するペルソナはまだありません。"),
    ).toBeInTheDocument();
  });

  it("ネガポジ合計・年代上位・トピック上位を表示する", () => {
    render(
      <PersonaPeriodSummary
        data={{
          totalCount: 6,
          ageSentiment: [
            { age: "60代", ...sentiment(2, 1) },
            { age: "30代", ...sentiment(0, 0, 1) },
            { age: "不明", ...sentiment(0, 0, 0, 2) },
          ],
          topics: [
            { topic: "交通", total: 3, ...sentiment(2, 1) },
            { topic: "除雪", total: 1, ...sentiment(0, 0, 1) },
            { topic: "その他", total: 2, ...sentiment(0, 0, 0, 2) },
            { topic: "医療", total: 0, ...sentiment() },
          ],
        }}
      />,
    );

    // ネガポジ凡例（topics 合算: positive 2 / negative 1 / request 1 / neutral 2）
    expect(screen.getByText("ポジティブ 2")).toBeInTheDocument();
    expect(screen.getByText("ネガティブ 1")).toBeInTheDocument();
    expect(screen.getByText("要望 1")).toBeInTheDocument();
    expect(screen.getByText("中立 2")).toBeInTheDocument();

    // 年代上位（件数順）と 0 件トピックの除外
    expect(screen.getByText("60代")).toBeInTheDocument();
    expect(screen.getByText("交通")).toBeInTheDocument();
    expect(screen.queryByText("医療")).not.toBeInTheDocument();
  });
});
