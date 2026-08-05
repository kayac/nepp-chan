import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WeekSummary } from "./WeekSummary";

const baseProps = {
  conversationCount: 34,
  voiceCount: 21,
  bars: [
    {
      date: "2026-08-02",
      label: "8/2(日)",
      conversations: 4,
      closed: true,
    },
    {
      date: "2026-08-03",
      label: "8/3(月)",
      conversations: 6,
      closed: false,
    },
  ],
  platforms: [
    { platform: "line", count: 20 },
    { platform: "web", count: 14 },
  ],
  sentiments: { positive: 8, negative: 5, request: 3, neutral: 5 },
  ages: [
    { label: "50代", count: 8 },
    { label: "40代", count: 5 },
  ],
  residences: [{ label: "村内", count: 12 }],
  relationships: [{ label: "村人", count: 10 }],
  onShowConversations: vi.fn(),
  onShowVillage: vi.fn(),
  onShowSentiment: vi.fn(),
};

describe("WeekSummary", () => {
  it("会話と声の件数・流入元を出す", () => {
    render(<WeekSummary {...baseProps} />);

    const strip = screen.getByTestId("activity-strip");
    expect(strip.textContent).toContain("会話 34件");
    expect(strip.textContent).toContain("集まった声 21件");
    expect(strip.textContent).toContain("LINE 20 · Web 14");
  });

  it("流入元が空なら内訳を出さない", () => {
    render(<WeekSummary {...baseProps} platforms={[]} />);

    expect(screen.getByTestId("activity-strip").textContent).not.toContain(
      "LINE",
    );
  });

  it("会話は会話セクション、声は村の全体像へ遷移する", async () => {
    const onShowConversations = vi.fn();
    const onShowVillage = vi.fn();
    render(
      <WeekSummary
        {...baseProps}
        onShowConversations={onShowConversations}
        onShowVillage={onShowVillage}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /会話 34/ }));
    expect(onShowConversations).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /集まった声 21/ }));
    expect(onShowVillage).toHaveBeenCalled();
  });

  it("日別の会話数グラフを出す", () => {
    render(<WeekSummary {...baseProps} />);

    expect(screen.getByTestId("week-trend")).toBeInTheDocument();
  });

  it("日別データがなければグラフを出さない", () => {
    render(<WeekSummary {...baseProps} bars={[]} />);

    expect(screen.queryByTestId("week-trend")).toBeNull();
  });

  it("声の内訳を感情ごとの件数で出す", () => {
    render(<WeekSummary {...baseProps} />);

    const breakdown = screen.getByTestId("sentiment-breakdown");
    expect(breakdown.textContent).toContain("ポジティブ 8");
    expect(breakdown.textContent).toContain("ネガティブ 5");
    expect(breakdown.textContent).toContain("要望 3");
    expect(breakdown.textContent).toContain("中立 5");
  });

  it("ポジ・ネガ・要望は声一覧へ絞り込んで遷移できる", async () => {
    const onShowSentiment = vi.fn();
    render(<WeekSummary {...baseProps} onShowSentiment={onShowSentiment} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ポジティブ 8/ }));
    expect(onShowSentiment).toHaveBeenCalledWith("positive");

    await user.click(screen.getByRole("button", { name: /要望 3/ }));
    expect(onShowSentiment).toHaveBeenCalledWith("request");
  });

  it("中立は絞り込み条件にないためボタンにしない", () => {
    render(<WeekSummary {...baseProps} />);

    expect(screen.queryByRole("button", { name: /中立 5/ })).toBeNull();
  });

  it("声が 0 件なら内訳を出さない", () => {
    render(
      <WeekSummary
        {...baseProps}
        sentiments={{ positive: 0, negative: 0, request: 0, neutral: 0 }}
      />,
    );

    expect(screen.queryByTestId("sentiment-breakdown")).toBeNull();
  });

  it("声の分布を年代・住まい・立場のラベルで出す", () => {
    render(<WeekSummary {...baseProps} />);

    const speakers = screen.getByTestId("speaker-breakdown");
    expect(speakers.textContent).toContain("年代");
    expect(speakers.textContent).toContain("50代 8");
    expect(speakers.textContent).toContain("40代 5");
    expect(speakers.textContent).toContain("住まい");
    expect(speakers.textContent).toContain("村内 12");
    expect(speakers.textContent).toContain("立場");
    expect(speakers.textContent).toContain("村人 10");
  });

  it("内訳が取れていない区分の行は出さない", () => {
    render(<WeekSummary {...baseProps} residences={[]} />);

    const speakers = screen.getByTestId("speaker-breakdown");
    expect(speakers.textContent).not.toContain("住まい");
    expect(speakers.textContent).toContain("年代");
  });

  it("どの区分も取れていなければブロックを出さない", () => {
    render(
      <WeekSummary
        {...baseProps}
        ages={[]}
        residences={[]}
        relationships={[]}
      />,
    );

    expect(screen.queryByTestId("speaker-breakdown")).toBeNull();
  });
});
