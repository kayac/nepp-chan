import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopicRow } from "./TopicRow";

const baseProps = {
  topic: "観光",
  count: 8,
  chips: [
    { tag: "そば", count: 3 },
    { tag: "駅", count: 2 },
  ],
  sample: null,
  onShowVoices: vi.fn(),
};

describe("TopicRow", () => {
  it("話題名・件数・タグチップを出す", () => {
    render(<TopicRow {...baseProps} />);

    expect(screen.getByText("観光")).toBeVisible();
    expect(screen.getByText("8件")).toBeVisible();
    expect(screen.getByText("そば ×3")).toBeVisible();
    expect(screen.getByText("駅 ×2")).toBeVisible();
  });

  it("行クリックで話題名つきで onShowVoices を呼ぶ", async () => {
    const onShowVoices = vi.fn();
    render(<TopicRow {...baseProps} onShowVoices={onShowVoices} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    expect(onShowVoices).toHaveBeenCalledWith("観光");
  });

  it("代表の声を引用で出す", () => {
    render(
      <TopicRow {...baseProps} sample="音威子府そばがとても美味しかった" />,
    );

    expect(
      screen.getByText(/「音威子府そばがとても美味しかった」/),
    ).toBeVisible();
  });

  it("代表の声がなければ引用を出さない", () => {
    render(<TopicRow {...baseProps} sample={null} />);

    expect(screen.queryByText(/「/)).toBeNull();
  });

  it("タグがなければチップ行を出さない", () => {
    const { container } = render(<TopicRow {...baseProps} chips={[]} />);

    expect(container.querySelector("[data-testid=topic-chips]")).toBeNull();
  });
});
