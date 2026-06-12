import { render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  buildGreetingPrompt,
  GREETING_PROMPT,
} from "~/app/chat/greeting-prompt";

import { UserMessage } from "./UserMessage";

const userMessage = (text: string): UIMessage => ({
  id: "u-1",
  role: "user",
  parts: [{ type: "text", text }],
});

describe("UserMessage", () => {
  it("通常のテキストを表示する", () => {
    render(<UserMessage message={userMessage("おはよう")} />);
    expect(screen.getByText("おはよう")).toBeInTheDocument();
  });

  it("挨拶要求プロンプトは表示しない", () => {
    const { container } = render(
      <UserMessage message={userMessage(GREETING_PROMPT)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("location 入りの挨拶要求プロンプトも表示しない", () => {
    const { container } = render(
      <UserMessage message={userMessage(buildGreetingPrompt("天塩川温泉"))} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
