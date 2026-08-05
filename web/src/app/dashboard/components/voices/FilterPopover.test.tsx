import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterPopover } from "./FilterPopover";
import { DEFAULT_FILTER, type VoiceFilter } from "./helpers";

const setup = (
  overrides: Partial<VoiceFilter> = {},
  matchCount: number | null = 12,
) => {
  const onChange = vi.fn();
  render(
    <FilterPopover
      filter={{ ...DEFAULT_FILTER, ...overrides }}
      matchCount={matchCount}
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
};

describe("FilterPopover", () => {
  it("閉じている間は絞り込み項目を出さない", () => {
    setup();
    expect(screen.queryByText("いつの声か")).toBeNull();
  });

  it("開くと期間・どんな声か・話題を出す", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));

    expect(screen.getByText("いつの声か")).toBeVisible();
    expect(screen.getByText("どんな声か")).toBeVisible();
    expect(screen.getByText("話題")).toBeVisible();
  });

  it("誰の声か（セグメント）は絞り込み軸に出さない", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));

    expect(screen.queryByText("誰の声か")).toBeNull();
    expect(screen.queryByRole("button", { name: /村内住民/ })).toBeNull();
  });

  it("適用件数をボタンのラベルに出す", () => {
    setup({ period: "d7", sents: ["negative"], topic: "観光" });
    expect(
      screen.getByRole("button", { name: /絞り込む（3）/ }),
    ).toBeInTheDocument();
  });

  it("未適用ならラベルに件数を付けない", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "絞り込む" }),
    ).toBeInTheDocument();
  });

  it("期間を選ぶと onChange が呼ばれる", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    await user.click(screen.getByRole("button", { name: "直近7日" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ period: "d7" }),
    );
  });

  it("感情はトグルで追加・解除できる", async () => {
    const { user, onChange } = setup({ sents: ["negative"] });
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));

    await user.click(screen.getByRole("button", { name: "ネガティブ" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sents: [] }),
    );

    await user.click(screen.getByRole("button", { name: "要望" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sents: ["negative", "request"] }),
    );
  });

  it("すべて解除は並び順を保ったまま初期化する", async () => {
    const { user, onChange } = setup({ sents: ["negative"], sort: "topics" });
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    await user.click(screen.getByRole("button", { name: "すべて解除" }));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER,
      sort: "topics",
    });
  });

  it("該当件数を出し、null なら出さない", async () => {
    const { user } = setup({}, 12);
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    expect(screen.getByText("12件が該当")).toBeVisible();
  });

  it("この条件で見るで閉じる", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    await user.click(screen.getByRole("button", { name: "この条件で見る" }));

    expect(screen.queryByText("いつの声か")).toBeNull();
  });
});
